import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Hotel } from '../hotels/entities/hotel.entity';
import { UserRole } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    assignedHotelId: string | null;
  };
}

export interface RegisterPendingResponse {
  pending: true;
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterPendingResponse> {
    const existing = await this.users.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Self-registration is always for OWNER; ignore tampered roles.
    const role = UserRole.OWNER;
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Self-registered owners start *inactive* — admin must flip them on.
    const user = this.users.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      password: passwordHash,
      phone: dto.phone ?? null,
      role,
      isActive: false,
    });
    const saved = await this.users.save(user);
    void this.notifications.notifyAdminsNewOwner(
      saved.name,
      saved.email,
      saved.id,
    );
    return {
      pending: true,
      message:
        'Account created. An administrator must activate it before you can sign in.',
      user: {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        role: saved.role,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email: dto.email.toLowerCase() })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account is inactive. An administrator must activate it.',
      );
    }

    // Cascading: managers can't sign in if their owner is deactivated.
    if (user.role === UserRole.MANAGER && user.assignedHotelId) {
      const ownerStatus = await this.hotels
        .createQueryBuilder('h')
        .innerJoin('h.owner', 'o')
        .where('h.id = :id', { id: user.assignedHotelId })
        .select(['h.id', 'o.id', 'o.isActive'])
        .getRawOne<{ o_isActive: number | boolean }>();
      if (ownerStatus && !ownerStatus.o_isActive) {
        throw new ForbiddenException(
          'The hotel owner account is currently disabled.',
        );
      }
    }

    return this.buildResponse(user);
  }

  private buildResponse(user: User): AuthResponse {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedHotelId: user.assignedHotelId,
      },
    };
  }
}
