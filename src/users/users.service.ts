import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Brackets, Repository } from 'typeorm';
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const password = await bcrypt.hash(dto.password, 10);
    const user = this.users.create({
      name: dto.name.trim(),
      email,
      password,
      role: dto.role,
      phone: dto.phone ?? null,
      assignedHotelId: dto.assignedHotelId ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.users.save(user);
  }

  async findAll(
    pagination: PaginationDto,
    role?: UserRole,
    status?: 'active' | 'inactive',
  ): Promise<PaginatedResult<User>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.users.createQueryBuilder('user');
    if (role) qb.andWhere('user.role = :role', { role });
    if (status === 'active') qb.andWhere('user.isActive = :v', { v: true });
    if (status === 'inactive') qb.andWhere('user.isActive = :v', { v: false });
    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('LOWER(user.name) LIKE :term', { term })
            .orWhere('LOWER(user.email) LIKE :term', { term }),
        ),
      );
    }
    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const prevActive = user.isActive;

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const exists = await this.users.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (exists) throw new ConflictException('Email already in use');
      user.email = dto.email.toLowerCase().trim();
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.assignedHotelId !== undefined) {
      user.assignedHotelId = dto.assignedHotelId ?? null;
    }
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    const saved = await this.users.save(user);
    if (dto.isActive !== undefined && dto.isActive !== prevActive) {
      void this.notifications.notifyAccountStatus(saved.id, saved.isActive);
      if (!saved.isActive && saved.role === UserRole.OWNER) {
        void this.notifications.notifyManagersOwnerDeactivated(saved.id);
      }
    }
    return saved;
  }

  async remove(id: string): Promise<{ id: string }> {
    const result = await this.users.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
    return { id };
  }

  /** Toggle account active/inactive (admin only). */
  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findOne(id);
    if (user.isActive === isActive) return user;
    user.isActive = isActive;
    const saved = await this.users.save(user);
    void this.notifications.notifyAccountStatus(saved.id, saved.isActive);
    if (!isActive && saved.role === UserRole.OWNER) {
      void this.notifications.notifyManagersOwnerDeactivated(saved.id);
    }
    return saved;
  }

  /** Used by owner to list managers assigned to their hotels. */
  async findManagersForOwner(
    ownerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.users
      .createQueryBuilder('user')
      .innerJoin('hotels', 'h', 'h.id = user.assignedHotelId')
      .where('user.role = :role', { role: UserRole.MANAGER })
      .andWhere('h.ownerId = :ownerId', { ownerId });

    if (pagination.search) {
      const term = `%${pagination.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('LOWER(user.name) LIKE :term', { term })
            .orWhere('LOWER(user.email) LIKE :term', { term }),
        ),
      );
    }
    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }
}
