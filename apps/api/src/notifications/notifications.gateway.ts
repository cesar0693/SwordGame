import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { Notification } from '@swordgame/shared';

interface AuthedSocket extends Socket {
  data: { heroId?: string; userId?: string };
}

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

/**
 * Auth: clients pass their access token in `auth.token` at handshake
 * (preferred) or as `?token=…`. We verify it with the same secret as
 * the REST guards. Each authenticated socket joins `user:<userId>` and
 * `hero:<heroId>` rooms — services emit to the relevant room.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private readonly server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('Realtime gateway up');
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const raw =
        (client.handshake.auth?.['token'] as string | undefined) ||
        (client.handshake.query?.['token'] as string | undefined);
      if (!raw) throw new Error('missing token');

      const secret = this.config.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwt.verifyAsync<JwtPayload>(raw, { secret });
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      this.logger.debug(`socket ${client.id} joined user:${payload.sub}`);
    } catch (err) {
      this.logger.warn(
        `Rejecting socket ${client.id}: ${(err as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    this.logger.debug(`socket ${client.id} disconnected`);
  }

  /** Push a notification to every active socket of a given user. */
  emitToUser(userId: string, notification: Notification): void {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
