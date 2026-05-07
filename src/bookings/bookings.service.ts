import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/role.enum';
import { RoomStatus } from '../common/enums/room-status.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Room } from '../rooms/entities/room.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateBookingDto, user: AuthUser): Promise<Booking> {
    if (new Date(dto.checkOut) <= new Date(dto.checkIn)) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const room = await this.rooms.findOne({
      where: { id: dto.roomId },
      relations: ['hotel'],
    });
    if (!room) throw new NotFoundException('Room not found');
    this.assertRoomWriteAccess(room, user);

    const customer = await this.customers.findOne({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Check for date overlaps with active bookings
    const conflict = await this.bookings
      .createQueryBuilder('b')
      .where('b.roomId = :roomId', { roomId: dto.roomId })
      .andWhere('b.status IN (:...active)', {
        active: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('b.checkIn < :checkOut', { checkOut: dto.checkOut })
      .andWhere('b.checkOut > :checkIn', { checkIn: dto.checkIn })
      .getOne();
    if (conflict) {
      throw new BadRequestException(
        'Room has another booking that overlaps these dates',
      );
    }

    const totalAmount =
      dto.totalAmount ??
      this.estimateTotal(room.price, dto.checkIn, dto.checkOut);

    const booking = this.bookings.create({
      roomId: dto.roomId,
      customerId: dto.customerId,
      checkIn: new Date(dto.checkIn),
      checkOut: new Date(dto.checkOut),
      status: dto.status ?? BookingStatus.CONFIRMED,
      totalAmount: totalAmount.toFixed(2),
      notes: dto.notes ?? null,
    });
    const saved = await this.bookings.save(booking);

    if (saved.status === BookingStatus.CHECKED_IN) {
      await this.rooms.update(room.id, { status: RoomStatus.OCCUPIED });
    }

    const full = await this.bookings.findOne({
      where: { id: saved.id },
      relations: ['customer', 'room', 'room.hotel'],
    });
    if (full) void this.notifications.notifyBookingCreated(full, user.id);

    return saved;
  }

  async findAll(
    pagination: PaginationDto,
    user: AuthUser,
  ): Promise<PaginatedResult<Booking>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.bookings
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.customer', 'customer')
      .leftJoinAndSelect('b.room', 'room')
      .leftJoinAndSelect('room.hotel', 'hotel');

    if (user.role === UserRole.OWNER) {
      qb.andWhere('hotel.ownerId = :ownerId', { ownerId: user.id });
    } else if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        return buildPaginatedResult([], 0, page, limit);
      }
      qb.andWhere('hotel.id = :hid', { hid: user.assignedHotelId });
    }

    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((bb) =>
          bb
            .where('LOWER(customer.name) LIKE :term', { term })
            .orWhere('LOWER(room.roomNumber) LIKE :term', { term })
            .orWhere('LOWER(hotel.name) LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('b.checkIn', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, user: AuthUser): Promise<Booking> {
    const booking = await this.bookings.findOne({
      where: { id },
      relations: ['customer', 'room', 'room.hotel'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertBookingAccess(booking, user, 'read');
    return booking;
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    user: AuthUser,
  ): Promise<Booking> {
    const booking = await this.findOne(id, user);
    this.assertBookingAccess(booking, user, 'write');
    const prevStatus = booking.status;

    if (dto.checkIn !== undefined) booking.checkIn = new Date(dto.checkIn);
    if (dto.checkOut !== undefined) booking.checkOut = new Date(dto.checkOut);
    if (dto.totalAmount !== undefined) {
      booking.totalAmount = dto.totalAmount.toFixed(2);
    }
    if (dto.notes !== undefined) booking.notes = dto.notes ?? null;
    if (dto.customerId !== undefined) booking.customerId = dto.customerId;
    if (dto.status !== undefined) {
      await this.applyStatusTransition(booking, dto.status);
    }
    const saved = await this.bookings.save(booking);
    const full = await this.bookings.findOne({
      where: { id: saved.id },
      relations: ['customer', 'room', 'room.hotel'],
    });
    if (full) {
      const prevForMsg =
        dto.status !== undefined ? prevStatus : undefined;
      void this.notifications.notifyBookingUpdated(full, user.id, prevForMsg);
    }
    return saved;
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    user: AuthUser,
  ): Promise<Booking> {
    const booking = await this.findOne(id, user);
    this.assertBookingAccess(booking, user, 'write');
    const prevStatus = booking.status;
    await this.applyStatusTransition(booking, status);
    const saved = await this.bookings.save(booking);
    const full = await this.bookings.findOne({
      where: { id: saved.id },
      relations: ['customer', 'room', 'room.hotel'],
    });
    if (full) {
      void this.notifications.notifyBookingUpdated(
        full,
        user.id,
        prevStatus,
      );
    }
    return saved;
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const booking = await this.findOne(id, user);
    if (user.role === UserRole.MANAGER) {
      throw new ForbiddenException('Managers cannot delete bookings');
    }
    this.assertBookingAccess(booking, user, 'write');
    const bookingId = booking.id;
    await this.bookings.delete(bookingId);
    void this.notifications.notifyBookingRemoved(booking, user.id);
    return { id: bookingId };
  }

  // ---------- helpers ----------
  private estimateTotal(
    price: string,
    checkIn: string | Date,
    checkOut: string | Date,
  ) {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const ms = d2.getTime() - d1.getTime();
    // Hotel-style night counting: a partial calendar day still counts as
    // one night, so 14:00 -> 12:00 next day is 1 night.
    const nights = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24) - 0.25));
    return Number(price) * nights;
  }

  private async applyStatusTransition(b: Booking, next: BookingStatus) {
    b.status = next;
    if (next === BookingStatus.CHECKED_IN) {
      await this.rooms.update(b.roomId, { status: RoomStatus.OCCUPIED });
    } else if (
      next === BookingStatus.CHECKED_OUT ||
      next === BookingStatus.CANCELLED
    ) {
      await this.rooms.update(b.roomId, { status: RoomStatus.AVAILABLE });
    }
  }

  private assertRoomWriteAccess(room: Room, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && room.hotel.ownerId === user.id) return;
    if (
      user.role === UserRole.MANAGER &&
      room.hotelId === user.assignedHotelId
    ) {
      return;
    }
    throw new ForbiddenException('No access to this room');
  }

  private assertBookingAccess(
    booking: Booking,
    user: AuthUser,
    mode: 'read' | 'write',
  ) {
    if (user.role === UserRole.ADMIN) return;
    if (
      user.role === UserRole.OWNER &&
      booking.room?.hotel?.ownerId === user.id
    ) {
      return;
    }
    if (
      user.role === UserRole.MANAGER &&
      booking.room?.hotelId === user.assignedHotelId
    ) {
      return;
    }
    throw new ForbiddenException(`No ${mode} access to this booking`);
  }
}
