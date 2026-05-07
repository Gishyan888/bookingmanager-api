import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('hotels')
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 6, default: '4.5' })
  rating: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, (user) => user.hotels, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ownerId' })
  owner: User | null;

  @OneToMany(() => Room, (room) => room.hotel)
  rooms: Room[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
