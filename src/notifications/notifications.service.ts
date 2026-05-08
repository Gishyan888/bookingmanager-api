import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/role.enum';
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import type { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

export const NotificationType = {
  OWNER_REGISTERED: 'owner_registered',
  BOOKING_CREATED: 'booking_created',
  BOOKING_UPDATED: 'booking_updated',
  BOOKING_REMOVED: 'booking_removed',
  ACCOUNT_ACTIVATED: 'account_activated',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  OWNER_DEACTIVATED_MANAGER: 'owner_deactivated_manager',
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly gateway: NotificationsGateway,
  ) {}

  async findAllForUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Notification>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.repo.count({
      where: { userId, readAt: IsNull() },
    });
    return { count };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      n.readAt = new Date();
      await this.repo.save(n);
    }
    return n;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.repo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: res.affected ?? 0 };
  }

  /** Broadcast to every admin user. */
  async notifyAdminsNewOwner(
    ownerName: string,
    ownerEmail: string,
    ownerId: string,
  ): Promise<void> {
    const admins = await this.users.find({
      where: { role: UserRole.ADMIN, isActive: true },
      select: ['id'],
    });
    await this.deliver(
      admins.map((a) => a.id),
      {
        type: NotificationType.OWNER_REGISTERED,
        title: 'New owner registration',
        body: `${ownerName} (${ownerEmail}) registered and awaits activation.`,
        metadata: { ownerId, ownerName, ownerEmail },
      },
    );
  }

  async notifyAccountStatus(userId: string, active: boolean): Promise<void> {
    await this.deliver([userId], {
      type: active
        ? NotificationType.ACCOUNT_ACTIVATED
        : NotificationType.ACCOUNT_DEACTIVATED,
      title: active ? 'Account activated' : 'Account deactivated',
      body: active
        ? 'Your account is now active. You can sign in.'
        : 'Your account has been deactivated. Contact an administrator.',
      metadata: { active },
    });
  }

  async notifyManagersOwnerDeactivated(ownerId: string): Promise<void> {
    const managers = await this.users
      .createQueryBuilder('user')
      .innerJoin('hotels', 'h', 'h.id = user.assignedHotelId')
      .where('user.role = :role', { role: UserRole.MANAGER })
      .andWhere('h.ownerId = :ownerId', { ownerId })
      .andWhere('user.isActive = :ia', { ia: true })
      .getMany();
    const ids = managers.map((m) => m.id);
    if (!ids.length) return;
    await this.deliver(ids, {
      type: NotificationType.OWNER_DEACTIVATED_MANAGER,
      title: 'Hotel owner disabled',
      body:
        'Your hotel owner account was deactivated. Manager access is paused until the owner is re-enabled.',
      metadata: { ownerId },
    });
  }

  async notifyBookingCreated(booking: Booking, actorUserId: string): Promise<void> {
    const hotel = booking.room?.hotel;
    const customerName = booking.customer?.name ?? 'Guest';
    const hotelName = hotel?.name ?? 'Hotel';
    const recipients = await this.collectBookingRecipients(
      hotel?.id ?? null,
      hotel?.ownerId ?? null,
      actorUserId,
    );
    const title = 'New booking';
    const roomNumber = String(booking.room?.roomNumber ?? booking.roomId);
    const body = `${customerName} — ${hotelName}, room ${roomNumber}.`;
    await this.deliver(recipients, {
      type: NotificationType.BOOKING_CREATED,
      title,
      body,
      metadata: {
        bookingId: booking.id,
        hotelId: hotel?.id,
        status: booking.status,
        customerName,
        hotelName,
        roomNumber,
      },
    });
  }

  async notifyBookingUpdated(
    booking: Booking,
    actorUserId: string,
    prevStatus?: BookingStatus,
  ): Promise<void> {
    const hotel = booking.room?.hotel;
    const customerName = booking.customer?.name ?? 'Guest';
    const hotelName = hotel?.name ?? 'Hotel';
    const recipients = await this.collectBookingRecipients(
      hotel?.id ?? null,
      hotel?.ownerId ?? null,
      actorUserId,
    );
    const statusLine =
      prevStatus !== undefined && prevStatus !== booking.status
        ? `Status: ${prevStatus} → ${booking.status}`
        : `Status: ${booking.status}`;
    const roomNumber = String(booking.room?.roomNumber ?? booking.roomId);
    const title = 'Booking updated';
    const body = `${customerName} — ${hotelName}. ${statusLine}.`;
    await this.deliver(recipients, {
      type: NotificationType.BOOKING_UPDATED,
      title,
      body,
      metadata: {
        bookingId: booking.id,
        hotelId: hotel?.id,
        status: booking.status,
        prevStatus: prevStatus ?? null,
        customerName,
        hotelName,
        roomNumber,
      },
    });
  }

  async notifyBookingRemoved(
    booking: Booking,
    actorUserId: string,
  ): Promise<void> {
    const hotel = booking.room?.hotel;
    const customerName = booking.customer?.name ?? 'Guest';
    const hotelName = hotel?.name ?? 'Hotel';
    const recipients = await this.collectBookingRecipients(
      hotel?.id ?? null,
      hotel?.ownerId ?? null,
      actorUserId,
    );
    await this.deliver(recipients, {
      type: NotificationType.BOOKING_REMOVED,
      title: 'Booking removed',
      body: `${customerName} — ${hotelName} booking was deleted.`,
      metadata: {
        bookingId: booking.id,
        hotelId: hotel?.id,
        customerName,
        hotelName,
      },
    });
  }

  private async collectBookingRecipients(
    hotelId: string | null,
    ownerId: string | null,
    actorUserId: string,
  ): Promise<string[]> {
    const ids = new Set<string>();
    // Booking events are operational alerts for owner/manager only.
    // Admins do not need these notifications.
    if (ownerId) ids.add(ownerId);
    if (hotelId) {
      const managers = await this.users.find({
        where: {
          role: UserRole.MANAGER,
          assignedHotelId: hotelId,
          isActive: true,
        },
        select: ['id'],
      });
      managers.forEach((m) => ids.add(m.id));
    }
    ids.delete(actorUserId);
    return [...ids];
  }

  private async deliver(
    userIds: string[],
    payload: {
      type: NotificationTypeValue;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;

    try {
      const rows = unique.map((userId) =>
        this.repo.create({
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          metadata: payload.metadata ?? null,
          readAt: null,
        }),
      );
      const saved = await this.repo.save(rows);
      for (const n of saved) {
        this.gateway.emitToUser(n.userId, 'notification', this.toWire(n));
      }
    } catch (err) {
      this.logger.error('Failed to persist or push notifications', err);
    }
  }

  private toWire(n: Notification) {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      metadata: n.metadata,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
