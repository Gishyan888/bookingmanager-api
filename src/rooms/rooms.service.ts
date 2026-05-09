import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Booking } from '../bookings/entities/booking.entity';
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
import {
  addDays,
  BusyInterval,
  defaultStayForDay,
  formatWireDateTime,
  formatWireYmd,
  intervalOverlaps,
  parseRangeInclusive,
  wireLocalToDate,
} from './room-availability.helper';

const AVAILABILITY_MAX_RANGE_DAYS = 400;
const CHECK_OUT_SCAN_MAX_DAYS = 60;
const CHECK_OUT_MAX_SLOTS = 3500;

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
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

  /** Busy intervals + dates that allow the default 14:00 → next-day 12:00 stay. */
  async getAvailabilityCalendar(
    roomId: string,
    fromYmd: string,
    toYmd: string,
    user: AuthUser,
  ) {
    await this.findOne(roomId, user);
    const range = parseRangeInclusive(fromYmd, toYmd);
    if (!range) {
      throw new BadRequestException('Invalid from / to date range');
    }
    if (
      range.end.getTime() - range.start.getTime() >
      AVAILABILITY_MAX_RANGE_DAYS * 86400000
    ) {
      throw new BadRequestException(
        `Date range must be at most ${AVAILABILITY_MAX_RANGE_DAYS} days`,
      );
    }

    const windowEnd = addDays(range.end, 2);
    const busy = await this.loadBusyIntervals(roomId, range.start, windowEnd);

    const availableCheckInDates: string[] = [];
    for (
      let d = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        range.start.getDate(),
      );
      d.getTime() <= range.end.getTime();
      d = addDays(d, 1)
    ) {
      const ymd = formatWireYmd(d);
      const { checkIn, checkOut } = defaultStayForDay(ymd);
      if (!intervalOverlaps(checkIn, checkOut, busy)) {
        availableCheckInDates.push(ymd);
      }
    }

    return {
      roomId,
      from: fromYmd,
      to: toYmd,
      busyPeriods: busy.map((b) => ({
        checkIn: b.checkIn.toISOString(),
        checkOut: b.checkOut.toISOString(),
      })),
      availableCheckInDates,
    };
  }

  /** Half-hour check-in start times on a calendar day (with default 1-night stay to next 12:00). */
  async getCheckInTimes(
    roomId: string,
    dateYmd: string,
    user: AuthUser,
    onlyFuture: boolean,
  ) {
    await this.findOne(roomId, user);
    const probe = wireLocalToDate(`${dateYmd}T00:00`);
    if (Number.isNaN(probe.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const dayStart = new Date(
      probe.getFullYear(),
      probe.getMonth(),
      probe.getDate(),
      0,
      0,
      0,
      0,
    );
    const windowEnd = addDays(dayStart, 3);
    const busy = await this.loadBusyIntervals(roomId, dayStart, windowEnd);
    const now = new Date();
    const checkInTimes: string[] = [];

    for (let h = 0; h < 24; h++) {
      for (const mi of [0, 30]) {
        const hm = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
        const checkIn = wireLocalToDate(`${dateYmd}T${hm}`);
        if (onlyFuture && checkIn.getTime() < now.getTime()) {
          continue;
        }
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 1);
        checkOut.setHours(12, 0, 0, 0);
        if (checkOut.getTime() <= checkIn.getTime()) {
          continue;
        }
        if (!intervalOverlaps(checkIn, checkOut, busy)) {
          checkInTimes.push(hm);
        }
      }
    }

    return { roomId, date: dateYmd, checkInTimes, onlyFuture };
  }

  /** Valid check-out datetimes (30-minute steps) after the given check-in, until the next conflict. */
  async getCheckOutTimes(roomId: string, checkInWire: string, user: AuthUser) {
    await this.findOne(roomId, user);
    const checkIn = wireLocalToDate(checkInWire);
    if (Number.isNaN(checkIn.getTime())) {
      throw new BadRequestException('Invalid checkIn');
    }

    const windowEnd = addDays(checkIn, CHECK_OUT_SCAN_MAX_DAYS + 1);
    const busy = await this.loadBusyIntervals(roomId, checkIn, windowEnd);

    const slotMs = 30 * 60 * 1000;
    let cur = new Date(checkIn.getTime() + slotMs);
    const limit = addDays(checkIn, CHECK_OUT_SCAN_MAX_DAYS);
    const checkOutTimes: string[] = [];

    while (
      cur.getTime() <= limit.getTime() &&
      checkOutTimes.length < CHECK_OUT_MAX_SLOTS
    ) {
      if (!intervalOverlaps(checkIn, cur, busy)) {
        checkOutTimes.push(formatWireDateTime(cur));
      }
      cur = new Date(cur.getTime() + slotMs);
    }

    const dateSet = new Set(checkOutTimes.map((w) => w.slice(0, 10)));
    const availableCheckOutDates = [...dateSet].sort();

    return {
      roomId,
      checkIn: checkInWire,
      checkOutTimes,
      availableCheckOutDates,
    };
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

  private async loadBusyIntervals(
    roomId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<BusyInterval[]> {
    const rows = await this.bookings
      .createQueryBuilder('b')
      .select(['b.checkIn', 'b.checkOut'])
      .where('b.roomId = :roomId', { roomId })
      .andWhere('b.status IN (:...st)', {
        st: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('b.checkOut > :ws', { ws: windowStart })
      .andWhere('b.checkIn < :we', { we: windowEnd })
      .orderBy('b.checkIn', 'ASC')
      .getMany();
    return rows.map((b) => ({
      checkIn: b.checkIn,
      checkOut: b.checkOut,
    }));
  }
}
