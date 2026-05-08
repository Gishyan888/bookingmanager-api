import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuthOtpPurpose = 'verify_email' | 'forgot_password';

@Entity('auth_otps')
@Index('IDX_auth_otps_userId_purpose_usedAt', ['userId', 'purpose', 'usedAt'])
@Index('IDX_auth_otps_email_purpose_usedAt', ['email', 'purpose', 'usedAt'])
export class AuthOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 180 })
  email: string;

  @Column({ type: 'varchar', length: 24 })
  purpose: AuthOtpPurpose;

  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
