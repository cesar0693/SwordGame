import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PVP_CHALLENGE_COOLDOWN_SECONDS,
  PVP_LOSER_GOLD,
  applyElo,
  pvpWinnerGold,
  spellByCode,
  type ChallengeCooldownState,
  type CombatReport,
  type ConsumableEffect,
  type HeroClass,
  type HeroStats,
  type LeaderboardEntry,
  type PvpMatchSummary,
  type SpellDef,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from '../items/items.service';
import { ResourcesService } from '../resources/resources.service';
import { SpellsService } from '../spells/spells.service';
import { simulateCombat, type ConsumablePlan } from '../combat/combat.engine';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
    private readonly resources: ResourcesService,
    private readonly spells: SpellsService,
  ) {}

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------

  async leaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const rows = await this.prisma.hero.findMany({
      orderBy: [{ pvpRating: 'desc' }, { level: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        heroClass: true,
        level: true,
        pvpRating: true,
      },
    });
    return rows.map((r, i) => ({
      heroId: r.id,
      name: r.name,
      heroClass: r.heroClass as HeroClass,
      level: r.level,
      pvpRating: r.pvpRating,
      rank: i + 1,
    }));
  }

  // -----------------------------------------------------------------------
  // Cooldown
  // -----------------------------------------------------------------------

  async cooldown(heroId: string): Promise<ChallengeCooldownState> {
    const last = await this.prisma.pvpMatch.findFirst({
      where: { attackerId: heroId },
      orderBy: { playedAt: 'desc' },
      select: { playedAt: true },
    });
    if (!last) {
      return { ready: true, secondsRemaining: 0, nextReadyAt: null };
    }
    const nextReadyMs = last.playedAt.getTime() + PVP_CHALLENGE_COOLDOWN_SECONDS * 1000;
    const remaining = Math.max(0, Math.ceil((nextReadyMs - Date.now()) / 1000));
    return {
      ready: remaining <= 0,
      secondsRemaining: remaining,
      nextReadyAt: remaining > 0 ? new Date(nextReadyMs).toISOString() : null,
    };
  }

  // -----------------------------------------------------------------------
  // Match history
  // -----------------------------------------------------------------------

  async listMatches(heroId: string, limit = 20): Promise<PvpMatchSummary[]> {
    const rows = await this.prisma.pvpMatch.findMany({
      where: { OR: [{ attackerId: heroId }, { defenderId: heroId }] },
      orderBy: { playedAt: 'desc' },
      take: limit,
      include: {
        attacker: { select: { name: true } },
        defender: { select: { name: true } },
      },
    });
    return rows.map((r) => this.matchToDto(r));
  }

  // -----------------------------------------------------------------------
  // Challenge
  // -----------------------------------------------------------------------

  async challenge(
    attackerId: string,
    defenderId: string,
    consumableItemIds: string[],
  ): Promise<PvpMatchSummary> {
    if (attackerId === defenderId) {
      throw new ForbiddenException('Cannot challenge yourself');
    }
    if (consumableItemIds.length > 3) {
      throw new BadRequestException('At most 3 consumables');
    }

    return this.prisma.$transaction(async (tx) => {
      // Cooldown check
      const last = await tx.pvpMatch.findFirst({
        where: { attackerId },
        orderBy: { playedAt: 'desc' },
        select: { playedAt: true },
      });
      if (last) {
        const nextReady = last.playedAt.getTime() + PVP_CHALLENGE_COOLDOWN_SECONDS * 1000;
        if (Date.now() < nextReady) {
          throw new ConflictException('Still on challenge cooldown');
        }
      }

      const attacker = await tx.hero.findUnique({ where: { id: attackerId } });
      const defender = await tx.hero.findUnique({ where: { id: defenderId } });
      if (!attacker) throw new NotFoundException('Attacker not found');
      if (!defender) throw new NotFoundException('Defender not found');

      // Snapshot effective stats for both sides
      const atkEff = await this.snapshotStats(attackerId, attacker);
      const defEff = await this.snapshotStats(defenderId, defender);

      // Snapshot spells for both sides
      const atkSpells = await this.resolveSpells(attackerId, tx);
      const defSpells = await this.resolveSpells(defenderId, tx);

      // Attacker's consumables: validate + decrement stacks (escrow)
      const consumablePlan: ConsumablePlan[] = [];
      for (const id of consumableItemIds) {
        const item = await tx.item.findUnique({ where: { id } });
        if (!item || item.heroId !== attackerId) {
          throw new NotFoundException('Consumable not found');
        }
        if (item.kind !== 'CONSUMABLE' || !item.effect) {
          throw new BadRequestException('Not a consumable');
        }
        if (item.stack <= 0) throw new BadRequestException('Empty stack');

        consumablePlan.push({
          name: item.name,
          effect: item.effect as unknown as ConsumableEffect,
        });

        if (item.stack > 1) {
          await tx.item.update({
            where: { id: item.id },
            data: { stack: item.stack - 1 },
          });
        } else {
          await tx.item.delete({ where: { id: item.id } });
        }
      }

      // Run combat (deterministic given the seed)
      const seed = `pvp-${attackerId}-${defenderId}-${Date.now()}-${Math.floor(Math.random() * 0xffff)}`;
      const report = simulateCombat(
        {
          name: attacker.name,
          stats: atkEff,
          spells: atkSpells,
          consumables: consumablePlan,
        },
        { name: defender.name, stats: defEff, spells: defSpells },
        seed,
      );

      const attackerWon = report.outcome === 'VICTORY';
      const { newA, newB } = applyElo(
        attacker.pvpRating,
        defender.pvpRating,
        attackerWon ? 1 : 0,
      );

      const winnerGold = attackerWon
        ? pvpWinnerGold(attacker.pvpRating, defender.pvpRating)
        : pvpWinnerGold(defender.pvpRating, attacker.pvpRating);
      const loserGold = PVP_LOSER_GOLD;

      if (attackerWon) {
        await this.resources.add(attackerId, 'GOLD', winnerGold, tx);
        await this.resources.add(defenderId, 'GOLD', loserGold, tx);
      } else {
        await this.resources.add(defenderId, 'GOLD', winnerGold, tx);
        await this.resources.add(attackerId, 'GOLD', loserGold, tx);
      }

      await tx.hero.update({
        where: { id: attackerId },
        data: { pvpRating: newA },
      });
      await tx.hero.update({
        where: { id: defenderId },
        data: { pvpRating: newB },
      });

      const match = await tx.pvpMatch.create({
        data: {
          attackerId,
          defenderId,
          seed,
          outcome: attackerWon ? 'ATTACKER_WIN' : 'DEFENDER_WIN',
          attackerRatingBefore: attacker.pvpRating,
          defenderRatingBefore: defender.pvpRating,
          attackerRatingAfter: newA,
          defenderRatingAfter: newB,
          // Ranked combats have no mission-style rewards; gold is shown from
          // the rating delta at read time via pvpWinnerGold().
          report: { ...report, rewards: null } as unknown as Prisma.InputJsonValue,
        },
        include: {
          attacker: { select: { name: true } },
          defender: { select: { name: true } },
        },
      });

      return this.matchToDto(match);
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async snapshotStats(
    heroId: string,
    hero: {
      hp: number; mp: number; attack: number; defense: number; speed: number;
      critChance: number; critFailChance: number; dodgeChance: number;
    },
  ): Promise<HeroStats> {
    const bonuses = await this.items.effectiveBonuses(heroId);
    return this.items.applyBonusesTo(
      {
        hp: hero.hp,
        mp: hero.mp,
        attack: hero.attack,
        defense: hero.defense,
        speed: hero.speed,
        critChance: hero.critChance,
        critFailChance: hero.critFailChance,
        dodgeChance: hero.dodgeChance,
      },
      bonuses,
    );
  }

  private async resolveSpells(heroId: string, tx: Tx): Promise<SpellDef[]> {
    const codes = await this.spells.equippedCodes(heroId, tx);
    return codes.map((c) => spellByCode(c)).filter((s): s is SpellDef => !!s);
  }

  private matchToDto(
    row: Prisma.PvpMatchGetPayload<{
      include: {
        attacker: { select: { name: true } };
        defender: { select: { name: true } };
      };
    }>,
  ): PvpMatchSummary {
    const report = row.report as unknown as CombatReport;
    const attackerWon = row.outcome === 'ATTACKER_WIN';
    const winnerRating = attackerWon ? row.attackerRatingBefore : row.defenderRatingBefore;
    const loserRating = attackerWon ? row.defenderRatingBefore : row.attackerRatingBefore;
    const winnerGold = pvpWinnerGold(winnerRating, loserRating);
    return {
      id: row.id,
      attackerId: row.attackerId,
      attackerName: row.attacker.name,
      defenderId: row.defenderId,
      defenderName: row.defender.name,
      outcome: row.outcome as 'ATTACKER_WIN' | 'DEFENDER_WIN',
      attackerRatingBefore: row.attackerRatingBefore,
      attackerRatingAfter: row.attackerRatingAfter,
      defenderRatingBefore: row.defenderRatingBefore,
      defenderRatingAfter: row.defenderRatingAfter,
      winnerGold,
      loserGold: PVP_LOSER_GOLD,
      playedAt: row.playedAt.toISOString(),
      report,
    };
  }
}
