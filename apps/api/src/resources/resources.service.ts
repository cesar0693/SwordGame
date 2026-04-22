import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RESOURCE_TYPES, type ResourceType } from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure every resource row exists for the hero (call once on creation). */
  async seed(heroId: string, tx: Tx = this.prisma): Promise<void> {
    for (const type of RESOURCE_TYPES) {
      await tx.resource.upsert({
        where: { heroId_type: { heroId, type } },
        update: {},
        create: { heroId, type, amount: type === 'GOLD' ? 100 : 0 },
      });
    }
  }

  async listByHero(heroId: string): Promise<Array<{ type: ResourceType; amount: number }>> {
    const rows = await this.prisma.resource.findMany({
      where: { heroId },
      select: { type: true, amount: true },
      orderBy: { type: 'asc' },
    });
    return rows.map((r) => ({ type: r.type as ResourceType, amount: r.amount }));
  }

  /** Atomic delta: adds (can be negative). Throws if resulting amount < 0. */
  async add(
    heroId: string,
    type: ResourceType,
    delta: number,
    tx: Tx = this.prisma,
  ): Promise<void> {
    if (delta === 0) return;
    if (delta > 0) {
      await tx.resource.upsert({
        where: { heroId_type: { heroId, type } },
        create: { heroId, type, amount: delta },
        update: { amount: { increment: delta } },
      });
      return;
    }
    // Negative delta: ensure not overdrawing using a conditional update.
    const absDelta = -delta;
    const result = await tx.resource.updateMany({
      where: { heroId, type, amount: { gte: absDelta } },
      data: { amount: { decrement: absDelta } },
    });
    if (result.count === 0) {
      throw new Error(`Insufficient ${type}`);
    }
  }

  async get(heroId: string, type: ResourceType, tx: Tx = this.prisma): Promise<number> {
    const row = await tx.resource.findUnique({
      where: { heroId_type: { heroId, type } },
      select: { amount: true },
    });
    return row?.amount ?? 0;
  }
}
