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
import { Booking } from '../bookings/entities/booking.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {}

  async create(dto: CreateCustomerDto, user: AuthUser): Promise<Customer> {
    let ownerId: string | null = null;
    if (user.role === UserRole.ADMIN) {
      ownerId = null;
    } else if (user.role === UserRole.OWNER) {
      ownerId = user.id;
    } else if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        throw new ForbiddenException('Manager has no assigned hotel');
      }
      const hotel = await this.hotels.findOne({
        where: { id: user.assignedHotelId },
        select: ['id', 'ownerId'],
      });
      ownerId = hotel?.ownerId ?? null;
    }

    const customer = this.customers.create({
      name: dto.name.trim(),
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      idDocument: dto.idDocument ?? null,
      address: dto.description ?? dto.address ?? null,
      ownerId,
    });
    return this.customers.save(customer);
  }

  async findAll(
    pagination: PaginationDto,
    user: AuthUser,
  ): Promise<PaginatedResult<Customer>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.customers.createQueryBuilder('c');

    if (user.role === UserRole.OWNER) {
      // Owner sees customers either he created OR who booked rooms in his hotels
      qb.leftJoin('bookings', 'b', 'b.customerId = c.id')
        .leftJoin('rooms', 'r', 'r.id = b.roomId')
        .leftJoin('hotels', 'h', 'h.id = r.hotelId')
        .andWhere(
          new Brackets((b2) =>
            b2
              .where('c.ownerId = :uid', { uid: user.id })
              .orWhere('h.ownerId = :uid', { uid: user.id }),
          ),
        )
        .groupBy('c.id');
    } else if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        return buildPaginatedResult([], 0, page, limit);
      }
      const hotel = await this.hotels.findOne({
        where: { id: user.assignedHotelId },
        select: ['ownerId'],
      });
      const ho = hotel?.ownerId;
      qb.leftJoin('bookings', 'b', 'b.customerId = c.id')
        .leftJoin('rooms', 'r', 'r.id = b.roomId')
        .andWhere(
          new Brackets((bb) => {
            bb.where('r.hotelId = :hid', { hid: user.assignedHotelId });
            if (ho) {
              bb.orWhere('c.ownerId = :moid', { moid: ho });
            }
          }),
        )
        .groupBy('c.id');
    }

    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('LOWER(c.name) LIKE :term', { term })
            .orWhere('LOWER(c.email) LIKE :term', { term })
            .orWhere('LOWER(c.phone) LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, user: AuthUser): Promise<Customer> {
    const customer = await this.customers.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    await this.assertReadAccess(customer, user);
    return customer;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    user: AuthUser,
  ): Promise<Customer> {
    const customer = await this.findOne(id, user);
    await this.assertWriteAccess(customer, user);

    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.email !== undefined) customer.email = dto.email ?? null;
    if (dto.phone !== undefined) customer.phone = dto.phone ?? null;
    if (dto.idDocument !== undefined)
      customer.idDocument = dto.idDocument ?? null;
    if (dto.description !== undefined) {
      customer.address = dto.description ?? null;
    } else if (dto.address !== undefined) {
      customer.address = dto.address ?? null;
    }
    return this.customers.save(customer);
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const customer = await this.findOne(id, user);
    await this.assertWriteAccess(customer, user);
    await this.customers.delete(id);
    return { id };
  }

  private async assertReadAccess(c: Customer, user: AuthUser): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER) {
      if (c.ownerId === user.id) return;
      const n = await this.bookings
        .createQueryBuilder('b')
        .innerJoin('b.room', 'r')
        .innerJoin('r.hotel', 'h')
        .where('b.customerId = :cid', { cid: c.id })
        .andWhere('h.ownerId = :oid', { oid: user.id })
        .getCount();
      if (n > 0) return;
      throw new ForbiddenException('No access to this customer');
    }
    if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        throw new ForbiddenException('No access to this customer');
      }
      const ok = await this.managerCanAccessCustomer(c, user.assignedHotelId);
      if (!ok) throw new ForbiddenException('No access to this customer');
    }
  }

  private async assertWriteAccess(c: Customer, user: AuthUser): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.OWNER && c.ownerId === user.id) return;
    if (user.role === UserRole.MANAGER) {
      if (!user.assignedHotelId) {
        throw new ForbiddenException('No write access to this customer');
      }
      const ok = await this.managerCanAccessCustomer(c, user.assignedHotelId);
      if (!ok) throw new ForbiddenException('No write access to this customer');
      return;
    }
    throw new ForbiddenException('No write access to this customer');
  }

  /** Manager may touch customers linked to their hotel's owner or with a booking in that hotel. */
  private async managerCanAccessCustomer(
    c: Customer,
    hotelId: string,
  ): Promise<boolean> {
    const hotel = await this.hotels.findOne({
      where: { id: hotelId },
      select: ['ownerId'],
    });
    if (!hotel) return false;
    if (hotel.ownerId && c.ownerId === hotel.ownerId) return true;
    const n = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('b.room', 'r')
      .where('b.customerId = :cid', { cid: c.id })
      .andWhere('r.hotelId = :hid', { hid: hotelId })
      .getCount();
    return n > 0;
  }
}
