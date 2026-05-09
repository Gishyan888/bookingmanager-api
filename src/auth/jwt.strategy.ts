import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Hotel } from '../hotels/entities/hotel.entity';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import type { AuthUser } from './decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: [
        'id',
        'email',
        'role',
        'name',
        'assignedHotelId',
        'isActive',
        'preferredLanguage',
        'preferredTheme',
      ],
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    // Managers depend on their owner being active. If admin deactivates the
    // owner, every existing manager token instantly stops working.
    if (user.role === UserRole.MANAGER && user.assignedHotelId) {
      const ownerStatus = await this.hotels
        .createQueryBuilder('h')
        .innerJoin('h.owner', 'o')
        .where('h.id = :id', { id: user.assignedHotelId })
        .select(['h.id', 'o.id', 'o.isActive'])
        .getRawOne<{ o_isActive: number | boolean }>();
      if (!ownerStatus || !ownerStatus.o_isActive) {
        throw new UnauthorizedException(
          'Hotel owner is currently inactive — manager access disabled.',
        );
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      assignedHotelId: user.assignedHotelId,
      preferredLanguage: user.preferredLanguage,
      preferredTheme: user.preferredTheme,
    };
  }
}
