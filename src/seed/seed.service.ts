import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

/**
 * On an empty `users` table, optionally creates the first admin from
 * `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. No demo hotels,
 * rooms, customers, or bookings are inserted.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async run(): Promise<void> {
    const userCount = await this.users.count();
    if (userCount > 0) {
      this.logger.log(
        `Bootstrap skipped — users table already has ${userCount} row(s).`,
      );
      return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
    const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator';

    if (!email || !password.trim()) {
      this.logger.warn(
        'No users in the database. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first admin on startup. Owners can also self-register at POST /api/auth/register but remain inactive until an admin activates them.',
      );
      return;
    }

    if (password.length < 6) {
      this.logger.error(
        'BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters.',
      );
      return;
    }

    if (name.length < 2) {
      this.logger.error(
        'BOOTSTRAP_ADMIN_NAME must be at least 2 characters when set.',
      );
      return;
    }

    this.logger.log('Creating bootstrap admin user…');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(
      this.users.create({
        name,
        email,
        password: passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );

    this.logger.log(
      `Bootstrap complete: admin account created for ${email}. Unset BOOTSTRAP_ADMIN_PASSWORD in production once you have changed the password.`,
    );
  }
}
