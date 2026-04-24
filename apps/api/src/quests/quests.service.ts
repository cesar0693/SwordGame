import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  QUEST_CATALOG,
  QUESTS_PER_DAY,
  questByCode,
  type DailyQuestState,
  type QuestEventType,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';

type Tx = Prisma.TransactionClient;

function utcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
  ) {}

  // -----------------------------------------------------------------------
  // List (rolls today's 3 quests lazily on first call of the day)
  // -----------------------------------------------------------------------

  async listToday(heroId: string): Promise<DailyQuestState[]> {
    const today = utcDay();

    const existing = await this.prisma.dailyQuest.findMany({
      where: { heroId, day: today },
      orderBy: { id: 'asc' },
    });

    let rows = existing;
    if (rows.length === 0) {
      rows = await this.rollForDay(heroId, today);
    }

    return rows.map((r) => this.toDto(r));
  }

  private async rollForDay(heroId: string, day: Date) {
    const pool = [...QUEST_CATALOG];
    // shuffle (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const picked = pool.slice(0, QUESTS_PER_DAY);

    const created = await this.prisma.$transaction(
      picked.map((q) =>
        this.prisma.dailyQuest.create({
          data: {
            heroId,
            day,
            code: q.code,
            event: q.event,
            target: q.target,
          },
        }),
      ),
    );
    return created;
  }

  // -----------------------------------------------------------------------
  // Event dispatch: called from other services inside their transaction.
  // Bumps progress on every active quest of the matching event type, caps
  // at target, flips `completed` when reached. Claim stays manual.
  // -----------------------------------------------------------------------

  async incrementFor(
    heroId: string,
    event: QuestEventType,
    amount = 1,
    tx: Tx = this.prisma,
  ): Promise<void> {
    if (amount <= 0) return;
    const today = utcDay();
    const active = await tx.dailyQuest.findMany({
      where: { heroId, day: today, event, completed: false },
    });
    for (const q of active) {
      const newProgress = Math.min(q.target, q.progress + amount);
      const completed = newProgress >= q.target;
      await tx.dailyQuest.update({
        where: { id: q.id },
        data: { progress: newProgress, completed },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Claim a completed quest
  // -----------------------------------------------------------------------

  async claim(heroId: string, code: string): Promise<DailyQuestState> {
    const def = questByCode(code);
    if (!def) throw new BadRequestException('Unknown quest');
    const today = utcDay();

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dailyQuest.findUnique({
        where: { heroId_code_day: { heroId, code, day: today } },
      });
      if (!row) throw new NotFoundException('Quest not active today');
      if (!row.completed) throw new ConflictException('Not completed yet');
      if (row.claimed) throw new ConflictException('Already claimed');

      if (def.reward.gold > 0) {
        await this.resources.add(heroId, 'GOLD', def.reward.gold, tx);
      }
      if (def.reward.xp > 0) {
        await tx.hero.update({
          where: { id: heroId },
          data: { xp: { increment: def.reward.xp } },
        });
      }
      for (const [res, amount] of Object.entries(def.reward.resources ?? {})) {
        if (amount && amount > 0) {
          await this.resources.add(heroId, res as ResourceType, amount, tx);
        }
      }

      const updated = await tx.dailyQuest.update({
        where: { id: row.id },
        data: { claimed: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private toDto(row: {
    code: string;
    event: string;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
  }): DailyQuestState {
    const def = questByCode(row.code);
    return {
      code: row.code,
      event: row.event as QuestEventType,
      name: def?.name ?? row.code,
      description: def?.description ?? '',
      target: row.target,
      progress: row.progress,
      completed: row.completed,
      claimed: row.claimed,
      reward: def?.reward ?? { xp: 0, gold: 0 },
    };
  }
}
