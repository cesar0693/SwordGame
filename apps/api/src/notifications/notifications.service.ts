import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Notification, NotificationType } from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the userId behind a heroId (notifications are scoped to users
   * since a socket is bound to a user, not a hero).
   */
  private async userIdForHero(heroId: string): Promise<string | null> {
    const row = await this.prisma.hero.findUnique({
      where: { id: heroId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  async pushToHero(
    heroId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const userId = await this.userIdForHero(heroId);
    if (!userId) return;
    const notification: Notification = {
      id: randomUUID(),
      type,
      title,
      message,
      emittedAt: new Date().toISOString(),
      data,
    };
    this.gateway.emitToUser(userId, notification);
  }
}
