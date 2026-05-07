import {
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
import { UserRole } from '../common/enums/role.enum';
import { Hotel } from '../hotels/entities/hotel.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
  ) {}

  async create(dto: CreateRoomDto, user: AuthUser): Promise<Room> {
    const hotel = await this.hotels.findOne({ where: { id: dto.hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    this.assertHotelWriteAccess(hotel, user);

    const room = this.rooms.create({
      roomNumber: dto.roomNumber,
      type: dto.type,
      price: dto.price.toFixed(2),
      status: dto.status,
      capacity: dto.capacity ?? 1,
      description: dto.description ?? null,
      hotelId: dto.hotelId,
    });
    return this.rooms.save(room);
  }

  async findAll(
    pagination: PaginationDto,
    user: AuthUser,
    hotelId?: string,
  ): Promise<PaginatedResult<Room>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.rooms
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.hotel', 'hotel');

    this.applyScope(qb, user);
    if (hotelId) qb.andWhere('room.hotelId = :hotelId', { hotelId });

    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('LOWER(room.roomNumber) LIKE :term', { term })
            .orWhere('LOWER(room.type) LIKE :term', { term })
            .orWhere('LOWER(hotel.name) LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('room.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, user: AuthUser): Promise<Room> {
    const room = await this.rooms.findOne({
      where: { id },
      relations: ['hotel'],
    });
    if (!room) throw new NotFoundException('Room not found');
    this.assertHotelReadAccess(room.hotel, user);
    return room;
  }

  async update(id: string, dto: UpdateRoomDto, user: AuthUser): Promise<Room> {
    const room = await this.findOne(id, user);
    this.assertHotelWriteAccess(room.hotel, user);

    if (dto.roomNumber !== undefined) room.roomNumber = dto.roomNumber;
    if (dto.type !== undefined) room.type = dto.type;
    if (dto.price !== undefined) room.price = dto.price.toFixed(2);
    if (dto.status !== undefined) room.status = dto.status;
    if (dto.capacity !== undefined) room.capacity = dto.capacity;
    if (dto.description !== undefined)
      room.description = dto.description ?? null;
    return this.rooms.save(room);
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const room = await this.findOne(id, user);
    this.assertHotelWriteAccess(room.hotel, user);
    await this.rooms.delete(id);
    return { id };
  }

  // ------- helpers --------
  private applyScope(
    qb: ReturnType<Repository<Room>['createQueryBuilder']>,
    user: AuthUser,
  ) {
    if (user.role === UserRole.OWNER) {
      qb.andWhere('hotel.ownerId = :ownerId', { ownerId: user.id });
    } else if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('room.hotelId = :hid', { hid: user.assignedHotelId });
      }
    }
  }

  private assertHotelReadAccess(hotel: Hotel, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && hotel.ownerId === user.id) return;
    if (user.role === UserRole.MANAGER && hotel.id === user.assignedHotelId) {
      return;
    }
    throw new ForbiddenException('No access to this hotel');
  }

  private assertHotelWriteAccess(hotel: Hotel, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && hotel.ownerId === user.id) return;
    throw new ForbiddenException('No write access to this hotel');
  }
}
