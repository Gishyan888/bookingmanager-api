import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/role.enum';
import { RoomStatus } from '../common/enums/room-status.enum';
import { User } from '../users/entities/user.entity';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { Hotel } from './entities/hotel.entity';

export interface HotelWithStats extends Hotel {
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
  activeBookings: number;
}

@Injectable()
export class HotelsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateHotelDto, currentUser: AuthUser): Promise<Hotel> {
    let ownerId: string | null = null;
    if (currentUser.role === UserRole.ADMIN) {
      if (!dto.ownerId) {
        throw new BadRequestException('ownerId is required for admin');
      }
      const owner = await this.users.findOne({ where: { id: dto.ownerId } });
      if (!owner || owner.role !== UserRole.OWNER) {
        throw new BadRequestException('Owner not found');
      }
      ownerId = dto.ownerId;
    } else if (currentUser.role === UserRole.OWNER) {
      ownerId = currentUser.id;
    } else {
      throw new ForbiddenException('Managers cannot create hotels');
    }

    const hotel = this.hotels.create({
      name: dto.name.trim(),
      location: dto.location.trim(),
      description: dto.description ?? null,
      rating: dto.rating ?? '4.5',
      ownerId,
    });
    return this.hotels.save(hotel);
  }

  async findAll(
    pagination: PaginationDto,
    currentUser: AuthUser,
  ): Promise<PaginatedResult<HotelWithStats>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.hotels
      .createQueryBuilder('hotel')
      .leftJoinAndSelect('hotel.owner', 'owner');

    if (currentUser.role === UserRole.OWNER) {
      qb.andWhere('hotel.ownerId = :ownerId', { ownerId: currentUser.id });
    } else if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.assignedHotelId) {
        return buildPaginatedResult([], 0, page, limit);
      }
      qb.andWhere('hotel.id = :hid', { hid: currentUser.assignedHotelId });
    }

    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('LOWER(hotel.name) LIKE :term', { term })
            .orWhere('LOWER(hotel.location) LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('hotel.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [hotels, total] = await qb.getManyAndCount();
    const withStats = await this.attachStats(hotels);
    return buildPaginatedResult(withStats, total, page, limit);
  }

  async findOne(id: string, currentUser: AuthUser): Promise<HotelWithStats> {
    const hotel = await this.hotels.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!hotel) throw new NotFoundException('Hotel not found');
    this.assertReadAccess(hotel, currentUser);
    const [withStats] = await this.attachStats([hotel]);
    return withStats;
  }

  async update(
    id: string,
    dto: UpdateHotelDto,
    currentUser: AuthUser,
  ): Promise<Hotel> {
    const hotel = await this.findOneRaw(id);
    this.assertWriteAccess(hotel, currentUser);

    if (dto.name !== undefined) hotel.name = dto.name.trim();
    if (dto.location !== undefined) hotel.location = dto.location.trim();
    if (dto.description !== undefined)
      hotel.description = dto.description ?? null;
    if (dto.rating !== undefined) hotel.rating = dto.rating;
    if (currentUser.role === UserRole.ADMIN && dto.ownerId !== undefined) {
      hotel.ownerId = dto.ownerId;
    }
    return this.hotels.save(hotel);
  }

  async remove(id: string, currentUser: AuthUser): Promise<{ id: string }> {
    const hotel = await this.findOneRaw(id);
    this.assertWriteAccess(hotel, currentUser);
    await this.hotels.delete(id);
    return { id };
  }

  async assignOwner(id: string, ownerId: string): Promise<Hotel> {
    const hotel = await this.findOneRaw(id);
    const owner = await this.users.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new BadRequestException('Owner user not found');
    }
    hotel.ownerId = ownerId;
    return this.hotels.save(hotel);
  }

  // ---------- helpers ----------

  private async findOneRaw(id: string): Promise<Hotel> {
    const hotel = await this.hotels.findOne({ where: { id } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  private assertReadAccess(hotel: Hotel, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && hotel.ownerId === user.id) return;
    if (user.role === UserRole.MANAGER && hotel.id === user.assignedHotelId) {
      return;
    }
    throw new ForbiddenException('No access to this hotel');
  }

  private assertWriteAccess(hotel: Hotel, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && hotel.ownerId === user.id) return;
    throw new ForbiddenException('No write access to this hotel');
  }

  private async attachStats(hotels: Hotel[]): Promise<HotelWithStats[]> {
    if (hotels.length === 0) return [];
    const ids = hotels.map((h) => h.id);

    const roomsRaw = await this.hotels.manager
      .createQueryBuilder()
      .select('r.hotelId', 'hotelId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN r.status = '${RoomStatus.OCCUPIED}' THEN 1 ELSE 0 END)`,
        'occupied',
      )
      .from('rooms', 'r')
      .where('r.hotelId IN (:...ids)', { ids })
      .groupBy('r.hotelId')
      .getRawMany<{ hotelId: string; total: string; occupied: string }>();

    const bookingsRaw = await this.hotels.manager
      .createQueryBuilder()
      .select('r.hotelId', 'hotelId')
      .addSelect('COUNT(*)', 'active')
      .from('bookings', 'b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId IN (:...ids)', { ids })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
      })
      .groupBy('r.hotelId')
      .getRawMany<{ hotelId: string; active: string }>();

    const roomMap = new Map(roomsRaw.map((r) => [r.hotelId, r]));
    const bookingMap = new Map(bookingsRaw.map((b) => [b.hotelId, b]));

    return hotels.map((h) => {
      const r = roomMap.get(h.id);
      const b = bookingMap.get(h.id);
      const totalRooms = Number(r?.total ?? 0);
      const occupied = Number(r?.occupied ?? 0);
      return Object.assign(h, {
        totalRooms,
        bookedRooms: occupied,
        availableRooms: Math.max(0, totalRooms - occupied),
        activeBookings: Number(b?.active ?? 0),
      });
    });
  }
}
