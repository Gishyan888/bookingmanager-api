import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/role.enum';
import { RoomStatus } from '../common/enums/room-status.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { Room } from '../rooms/entities/room.entity';
import { User } from '../users/entities/user.entity';

export interface MonthlyPoint {
  label: string;
  bookings: number;
  revenue: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  async forUser(user: AuthUser) {
    if (user.role === UserRole.ADMIN) return this.adminStats();
    if (user.role === UserRole.OWNER) return this.ownerStats(user.id);
    return this.managerStats(user.assignedHotelId);
  }

  // ---------------- Admin ----------------
  private async adminStats() {
    const [
      totalOwners,
      totalHotels,
      totalRooms,
      totalBookings,
      totalCustomers,
    ] = await Promise.all([
      this.users.count({ where: { role: UserRole.OWNER } }),
      this.hotels.count(),
      this.rooms.count(),
      this.bookings.count(),
      this.customers.count(),
    ]);

    const occupiedRooms = await this.rooms.count({
      where: { status: RoomStatus.OCCUPIED },
    });

    const monthlyTrend = await this.monthlyTrend();
    const topHotels = await this.topHotels();

    return {
      role: UserRole.ADMIN,
      totals: {
        owners: totalOwners,
        hotels: totalHotels,
        rooms: totalRooms,
        bookings: totalBookings,
        customers: totalCustomers,
        occupiedRooms,
        availableRooms: Math.max(0, totalRooms - occupiedRooms),
      },
      occupancyRate:
        totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100),
      monthlyTrend,
      topHotels,
    };
  }

  // ---------------- Owner ----------------
  private async ownerStats(ownerId: string) {
    const hotelIds = (
      await this.hotels.find({ where: { ownerId }, select: ['id'] })
    ).map((h) => h.id);

    if (hotelIds.length === 0) {
      return {
        role: UserRole.OWNER,
        totals: {
          hotels: 0,
          rooms: 0,
          occupiedRooms: 0,
          availableRooms: 0,
          bookings: 0,
          customers: 0,
          revenue: 0,
        },
        occupancyRate: 0,
        monthlyTrend: [],
        roomStatus: { available: 0, occupied: 0, maintenance: 0 },
      };
    }

    const totalRooms = await this.rooms.count({
      where: hotelIds.map((id) => ({ hotelId: id })),
    });
    const occupied = await this.rooms.count({
      where: hotelIds.map((id) => ({
        hotelId: id,
        status: RoomStatus.OCCUPIED,
      })),
    });
    const maintenance = await this.rooms.count({
      where: hotelIds.map((id) => ({
        hotelId: id,
        status: RoomStatus.MAINTENANCE,
      })),
    });

    const bookings = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId IN (:...ids)', { ids: hotelIds })
      .getCount();

    const revenueRow = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId IN (:...ids)', { ids: hotelIds })
      .andWhere('b.status IN (:...paid)', {
        paid: [
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
          BookingStatus.CHECKED_OUT,
        ],
      })
      .select('SUM(b.totalAmount)', 'sum')
      .getRawOne<{ sum: string | null }>();

    const monthlyTrend = await this.monthlyTrend(hotelIds);

    return {
      role: UserRole.OWNER,
      totals: {
        hotels: hotelIds.length,
        rooms: totalRooms,
        occupiedRooms: occupied,
        availableRooms: Math.max(0, totalRooms - occupied - maintenance),
        bookings,
        customers: await this.customers.count({ where: { ownerId } }),
        revenue: Number(revenueRow?.sum ?? 0),
      },
      occupancyRate:
        totalRooms === 0 ? 0 : Math.round((occupied / totalRooms) * 100),
      monthlyTrend,
      roomStatus: {
        available: Math.max(0, totalRooms - occupied - maintenance),
        occupied,
        maintenance,
      },
    };
  }

  // ---------------- Manager ----------------
  private async managerStats(hotelId: string | null) {
    if (!hotelId) {
      return {
        role: UserRole.MANAGER,
        totals: {
          rooms: 0,
          occupiedRooms: 0,
          availableRooms: 0,
          bookings: 0,
          checkInsToday: 0,
          checkOutsToday: 0,
        },
        occupancyRate: 0,
        upcomingArrivals: [],
      };
    }
    const totalRooms = await this.rooms.count({ where: { hotelId } });
    const occupied = await this.rooms.count({
      where: { hotelId, status: RoomStatus.OCCUPIED },
    });

    const today = new Date().toISOString().slice(0, 10);
    const startOfToday = new Date(today + 'T00:00:00');
    const endOfTomorrow = new Date(startOfToday);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

    const checkInsToday = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId = :hotelId', { hotelId })
      .andWhere('DATE(b.checkIn) = :today', { today })
      .andWhere('b.status IN (:...active)', {
        active: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
      })
      .getCount();

    const checkOutsToday = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId = :hotelId', { hotelId })
      .andWhere('DATE(b.checkOut) = :today', { today })
      .andWhere('b.status = :status', { status: BookingStatus.CHECKED_IN })
      .getCount();

    const upcomingArrivals = await this.bookings.find({
      where: {
        room: { hotelId },
        status: BookingStatus.CONFIRMED,
        checkIn: Between(startOfToday, endOfTomorrow),
      },
      relations: ['room', 'customer'],
      take: 10,
    });

    const totalBookings = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .where('r.hotelId = :hotelId', { hotelId })
      .getCount();

    return {
      role: UserRole.MANAGER,
      totals: {
        rooms: totalRooms,
        occupiedRooms: occupied,
        availableRooms: Math.max(0, totalRooms - occupied),
        bookings: totalBookings,
        checkInsToday,
        checkOutsToday,
      },
      occupancyRate:
        totalRooms === 0 ? 0 : Math.round((occupied / totalRooms) * 100),
      upcomingArrivals,
    };
  }

  // ---------------- helpers ----------------
  private async monthlyTrend(hotelIds?: string[]): Promise<MonthlyPoint[]> {
    // last 6 months, grouped by year-month
    const months: { y: number; m: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }

    const qb = this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .select('YEAR(b.createdAt)', 'y')
      .addSelect('MONTH(b.createdAt)', 'm')
      .addSelect('COUNT(*)', 'c')
      .addSelect('SUM(b.totalAmount)', 'rev')
      .groupBy('y, m');

    if (hotelIds && hotelIds.length) {
      qb.where('r.hotelId IN (:...ids)', { ids: hotelIds });
    }

    const rows = await qb.getRawMany<{
      y: number;
      m: number;
      c: string;
      rev: string;
    }>();
    const map = new Map<string, { c: number; rev: number }>();
    for (const r of rows) {
      map.set(`${r.y}-${r.m}`, { c: Number(r.c), rev: Number(r.rev ?? 0) });
    }

    return months.map(({ y, m }) => {
      const k = `${y}-${m}`;
      const v = map.get(k) ?? { c: 0, rev: 0 };
      return {
        label: `${y}-${String(m).padStart(2, '0')}`,
        bookings: v.c,
        revenue: v.rev,
      };
    });
  }

  private async topHotels(limit = 5) {
    return this.bookings
      .createQueryBuilder('b')
      .innerJoin('rooms', 'r', 'r.id = b.roomId')
      .innerJoin('hotels', 'h', 'h.id = r.hotelId')
      .select('h.id', 'id')
      .addSelect('h.name', 'name')
      .addSelect('h.location', 'location')
      .addSelect('COUNT(*)', 'bookings')
      .addSelect('SUM(b.totalAmount)', 'revenue')
      .groupBy('h.id')
      .orderBy('bookings', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        name: string;
        location: string;
        bookings: string;
        revenue: string;
      }>();
  }
}
