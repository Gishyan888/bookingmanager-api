import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/role.enum';
import { Hotel } from '../../hotels/entities/hotel.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 180 })
  email: string;

  @Column({ type: 'varchar', select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MANAGER })
  role: UserRole;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  /**
   * Account on/off switch.
   *
   * - Newly self-registered owners start at `false` (admin must activate).
   * - Admin-created users default to `true`.
   * - Managers whose owner is `false` are also rejected at login.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * For managers: hotel they're assigned to (single hotel scope).
   * For owners/admins this is null.
   */
  @Column({ type: 'varchar', length: 36, nullable: true })
  assignedHotelId: string | null;

  /**
   * Hotels owned by this user (only when role = owner).
   */
  @OneToMany(() => Hotel, (hotel) => hotel.owner)
  hotels: Hotel[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
