import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Hotel } from '../hotels/entities/hotel.entity';
import { UserRole } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthOtp, AuthOtpPurpose } from './entities/auth-otp.entity';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordConfirmDto } from './dto/forgot-password-confirm.dto';

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
  otpSent: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  private mailTransporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    @InjectRepository(AuthOtp)
    private readonly otps: Repository<AuthOtp>,
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
    const { otp } = await this.issueOtp(saved, 'verify_email');
    await this.sendOtpEmail(saved.email, otp, 'verify_email');
    this.logOtp(saved.email, 'verify_email', otp);
    void this.notifications.notifyAdminsNewOwner(
      saved.name,
      saved.email,
      saved.id,
    );
    return {
      pending: true,
      message:
        'Account created. Verify your email with OTP. An administrator must activate your account before sign in.',
      otpSent: true,
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

  async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<{ verified: true }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    await this.consumeOtp(user, 'verify_email', dto.otp);
    return { verified: true };
  }

  async resendEmailOtp(
    dto: ResendEmailOtpDto,
  ): Promise<{ sent: true; expiresInSeconds: number }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    const { otp, ttlSeconds } = await this.issueOtp(user, 'verify_email');
    await this.sendOtpEmail(user.email, otp, 'verify_email');
    this.logOtp(user.email, 'verify_email', otp);
    return { sent: true, expiresInSeconds: ttlSeconds };
  }

  async requestPasswordReset(
    dto: ForgotPasswordRequestDto,
  ): Promise<{ sent: true; expiresInSeconds: number }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      // Prevent user enumeration.
      return { sent: true, expiresInSeconds: 600 };
    }
    const { otp, ttlSeconds } = await this.issueOtp(user, 'forgot_password');
    await this.sendOtpEmail(user.email, otp, 'forgot_password');
    this.logOtp(user.email, 'forgot_password', otp);
    return { sent: true, expiresInSeconds: ttlSeconds };
  }

  async confirmPasswordReset(
    dto: ForgotPasswordConfirmDto,
  ): Promise<{ reset: true }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    await this.consumeOtp(user, 'forgot_password', dto.otp);
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
    return { reset: true };
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

  private generateOtpCode(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private async issueOtp(
    user: User,
    purpose: AuthOtpPurpose,
  ): Promise<{ otp: string; ttlSeconds: number }> {
    const ttlSeconds = 10 * 60;
    const otp = this.generateOtpCode();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.otps.update(
      { userId: user.id, purpose, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const row = this.otps.create({
      userId: user.id,
      email: user.email,
      purpose,
      codeHash,
      expiresAt,
      usedAt: null,
    });
    await this.otps.save(row);
    return { otp, ttlSeconds };
  }

  private async consumeOtp(
    user: User,
    purpose: AuthOtpPurpose,
    otp: string,
  ): Promise<void> {
    const active = await this.otps.findOne({
      where: {
        userId: user.id,
        purpose,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!active) throw new BadRequestException('OTP is invalid or expired');
    const ok = await bcrypt.compare(otp, active.codeHash);
    if (!ok) throw new BadRequestException('OTP is invalid or expired');
    active.usedAt = new Date();
    await this.otps.save(active);
  }

  private logOtp(email: string, purpose: AuthOtpPurpose, otp: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH_OTP] ${purpose} ${email} -> ${otp}`);
    }
  }

  private getMailer(): nodemailer.Transporter {
    if (this.mailTransporter) return this.mailTransporter;
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT || '587');
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (!host || !port || !user || !pass) {
      throw new InternalServerErrorException(
        'Mail is not configured. Missing MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS',
      );
    }

    this.mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      requireTLS: port !== 465,
    });
    return this.mailTransporter;
  }

  private async sendOtpEmail(
    to: string,
    otp: string,
    purpose: AuthOtpPurpose,
  ): Promise<void> {
    const from = process.env.MAIL_FROM || process.env.MAIL_USER || '';
    if (!from) {
      throw new InternalServerErrorException(
        'Mail is not configured. Missing MAIL_FROM or MAIL_USER',
      );
    }

    const subject =
      purpose === 'verify_email'
        ? 'BookingManager email verification code'
        : 'BookingManager password reset code';
    const action =
      purpose === 'verify_email' ? 'verify your email' : 'reset your password';

    try {
      const mailer = this.getMailer();
      await mailer.sendMail({
        from,
        to,
        subject,
        text: `Your OTP code is ${otp}. It expires in 10 minutes. Use this code to ${action}.`,
        html: `<p>Your OTP code is <b>${otp}</b>.</p><p>It expires in <b>10 minutes</b>.</p><p>Use this code to ${action}.</p>`,
      });
    } catch (err) {
      console.error('[MAIL_SEND_FAILED]', err);
      throw new InternalServerErrorException(
        'Could not send OTP email. Check SMTP settings and server egress rules.',
      );
    }
  }
}
