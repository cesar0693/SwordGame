import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { dailyGoldFor, type ClaimDailyResponse, type DailyClaimState } from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';

/** Returns the UTC day (midnight) as a Date. */
function utcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayDiff(a: Date, b: Date): number {
  const ms = utcDay(a).getTime() - utcDay(b).getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
  ) {}

  async getState(heroId: string): Promise<DailyClaimState> {
    const last = await this.prisma.dailyClaim.findFirst({
      where: { heroId },
      orderBy: { day: 'desc' },
    });

    const today = utcDay();
    let streak = 0;
    let canClaimToday = true;

    if (last) {
      const diff = dayDiff(today, last.day);
      if (diff === 0) {
        streak = last.streak;
        canClaimToday = false;
      } else if (diff === 1) {
        streak = last.streak;
      } else {
        streak = 0;
      }
    }

    const nextStreak = canClaimToday ? streak + 1 : streak;

    return {
      lastClaimDay: last?.day.toISOString() ?? null,
      streak,
      canClaimToday,
      previewGold: dailyGoldFor(Math.max(1, nextStreak)),
    };
  }

  async claim(heroId: string): Promise<ClaimDailyResponse> {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.dailyClaim.findFirst({
        where: { heroId },
        orderBy: { day: 'desc' },
      });

      const today = utcDay();
      if (last && dayDiff(today, last.day) === 0) {
        throw new ConflictException('Already claimed today');
      }

      const continuing = last && dayDiff(today, last.day) === 1;
      const newStreak = continuing ? last.streak + 1 : 1;
      const rewardGold = dailyGoldFor(newStreak);

      await tx.dailyClaim.create({
        data: { heroId, day: today, streak: newStreak, rewardGold },
      });
      await this.resources.add(heroId, 'GOLD', rewardGold, tx);

      return { rewardGold, newStreak };
    });
  }
}
