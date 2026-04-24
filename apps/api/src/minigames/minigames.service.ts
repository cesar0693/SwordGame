import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MINIGAME_CATALOG,
  type MinigameCode,
  type MinigameDef,
  type MinigamePlayResult,
  type MinigameState,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import { QuestsService } from '../quests/quests.service';

function utcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class MinigamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
    private readonly quests: QuestsService,
  ) {}

  // -----------------------------------------------------------------------
  // State (which free plays are available today)
  // -----------------------------------------------------------------------

  async state(heroId: string): Promise<MinigameState[]> {
    const today = utcDay();
    const plays = await this.prisma.minigamePlay.findMany({
      where: { heroId, day: today, wasFree: true },
      select: { code: true },
    });
    const usedFree = new Set(plays.map((p) => p.code));
    return Object.values(MINIGAME_CATALOG).map((def) => ({
      code: def.code,
      def,
      freePlayAvailable: def.dailyFree && !usedFree.has(def.code),
    }));
  }

  // -----------------------------------------------------------------------
  // Play
  // -----------------------------------------------------------------------

  async play(
    heroId: string,
    code: MinigameCode,
    betGold: number,
    choice?: 'HEADS' | 'TAILS',
  ): Promise<MinigamePlayResult> {
    const def: MinigameDef | undefined = MINIGAME_CATALOG[code];
    if (!def) throw new BadRequestException('Unknown minigame');
    if (betGold < def.minBet || betGold > def.maxBet) {
      throw new BadRequestException(
        `Bet must be between ${def.minBet} and ${def.maxBet}`,
      );
    }
    if (code === 'COIN_FLIP' && choice !== 'HEADS' && choice !== 'TAILS') {
      throw new BadRequestException('COIN_FLIP requires choice');
    }

    const today = utcDay();
    return this.prisma.$transaction(async (tx) => {
      const existingFree = await tx.minigamePlay.findFirst({
        where: { heroId, day: today, code, wasFree: true },
        select: { id: true },
      });
      const wasFree = def.dailyFree && !existingFree;

      // Debit the bet only if this isn't the free play.
      if (!wasFree) {
        await this.resources.add(heroId, 'GOLD', -betGold, tx);
      }

      // Resolve
      let win = false;
      let netGold = 0;
      const outcome: Record<string, unknown> = {};

      if (code === 'COIN_FLIP') {
        const flip: 'HEADS' | 'TAILS' = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
        win = flip === choice;
        outcome['flip'] = flip;
        outcome['choice'] = choice;
        if (win) {
          // Free play still rewards if it wins (otherwise it's boring):
          // payout = betGold (doubled wager on paid, flat win on free).
          const payout = wasFree ? betGold : betGold * 2;
          await this.resources.add(heroId, 'GOLD', payout, tx);
          netGold = wasFree ? payout : payout - betGold;
        } else {
          netGold = wasFree ? 0 : -betGold;
        }
      } else {
        // DICE_ROLL
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        const d3 = 1 + Math.floor(Math.random() * 6);
        const sum = d1 + d2 + d3;
        win = sum >= 12;
        outcome['dice'] = [d1, d2, d3];
        outcome['sum'] = sum;
        if (win) {
          const payout = Math.round(betGold * 2.5);
          await this.resources.add(heroId, 'GOLD', payout, tx);
          netGold = wasFree ? payout : payout - betGold;
        } else {
          netGold = wasFree ? 0 : -betGold;
        }
      }

      await tx.minigamePlay.create({
        data: {
          heroId,
          code,
          day: today,
          betGold,
          wasFree,
          win,
          netGold,
          outcome: outcome as unknown as Prisma.InputJsonValue,
        },
      });

      // Any minigame play counts toward the GAMBLER daily quest.
      await this.quests.incrementFor(heroId, 'MINIGAME_PLAY', 1, tx);

      const hero = await tx.hero.findUnique({ where: { id: heroId } });
      if (!hero) throw new NotFoundException('Hero not found');
      const goldRow = await tx.resource.findUnique({
        where: { heroId_type: { heroId, type: 'GOLD' } },
        select: { amount: true },
      });

      const result: MinigamePlayResult = {
        code,
        betGold,
        wasFree,
        choice,
        win,
        netGold,
        newGold: goldRow?.amount ?? 0,
      };
      if (code === 'COIN_FLIP') {
        result.flipOutcome = outcome['flip'] as 'HEADS' | 'TAILS';
      } else {
        result.diceRoll = outcome['dice'] as [number, number, number];
        result.diceSum = outcome['sum'] as number;
      }
      return result;
    });
  }
}
