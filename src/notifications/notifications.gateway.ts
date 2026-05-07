import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const fromAuth =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    const header = client.handshake.headers?.authorization;
    const fromHeader =
      typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : null;
    const token = fromAuth || fromHeader;
    if (!token) {
      this.logger.warn('Socket connected without token — closing');
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const userId = payload.sub;
      void client.join(`user:${userId}`);
      client.data.userId = userId;
    } catch {
      client.disconnect(true);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_client: Socket) {}

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
