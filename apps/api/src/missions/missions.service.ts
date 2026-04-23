import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONSUMABLE_CATALOG,
  LEVEL_UP_FREE_POINTS,
  LEVEL_UP_GAINS,
  MISSION_CATALOG,
  missionByCode,
  xpForLevel,
  type CombatReport,
  type CombatRewardItem,
  type CombatRewards,
  type ConsumableEffect,
  type Item,
  type MissionDef,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from '../items/items.service';
import { ResourcesService } from '../resources/resources.service';
import { simulateCombat } from './combat.engine';

type Tx = Prisma.TransactionClient;

export interface MissionCard {
  def: MissionDef;
  runStatus: 'NONE' | 'PENDING' | 'COMPLETED' | 'CLAIMED';
  runId: string | null;
  startAt: string | null;
  finishAt: string | null;
}

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
    private readonly resources: ResourcesService,
  ) {}

  // -----------------------------------------------------------------------
  // Read
  // -----------------------------------------------------------------------

  listCatalog(): MissionDef[] {
    return MISSION_CATALOG;
  }

  async activeRun(heroId: string): Promise<{
    runId: string;
    missionCode: string;
    startAt: string;
    finishAt: string;
    status: string;
    consumableItemIds: string[];
  } | null> {
    const run = await this.prisma.missionRun.findFirst({
      where: { heroId, status: { in: ['PENDING', 'COMPLETED'] } },
      orderBy: { startAt: 'desc' },
    });
    if (!run) return null;
    // auto-promote PENDING → COMPLETED if timer is over
    const now = new Date();
    if (run.status === 'PENDING' && run.finishAt <= now) {
      await this.prisma.missionRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED' },
      });
      run.status = 'COMPLETED';
    }
    return {
      runId: run.id,
      missionCode: run.missionCode,
      startAt: run.startAt.toISOString(),
      finishAt: run.finishAt.toISOString(),
      status: run.status,
      consumableItemIds: (run.consumableItemIds as string[]) ?? [],
    };
  }

  // -----------------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------------

  async start(
    heroId: string,
    missionCode: string,
    consumableItemIds: string[],
  ): Promise<{ runId: string; startAt: string; finishAt: string }> {
    const def = missionByCode(missionCode);
    if (!def) throw new BadRequestException('Unknown mission');

    return this.prisma.$transaction(async (tx) => {
      const hero = await tx.hero.findUnique({ where: { id: heroId } });
      if (!hero) throw new NotFoundException('Hero not found');
      if (hero.level < def.minHeroLevel) {
        throw new BadRequestException(`Requires hero level ${def.minHeroLevel}`);
      }
      // Block if another mission is active
      const active = await tx.missionRun.findFirst({
        where: { heroId, status: { in: ['PENDING', 'COMPLETED'] } },
      });
      if (active) throw new ConflictException('A mission is already active');

      // Escrow consumables: decrement 1 stack per id; remove row if stack=0
      if (consumableItemIds.length > 3) {
        throw new BadRequestException('At most 3 consumables per mission');
      }
      const consumablePlan: Array<{ name: string; effect: ConsumableEffect }> = [];
      for (const id of consumableItemIds) {
        const item = await tx.item.findUnique({ where: { id } });
        if (!item || item.heroId !== heroId) {
          throw new NotFoundException('Consumable not found');
        }
        if (item.kind !== 'CONSUMABLE' || !item.effect) {
          throw new BadRequestException('Not a consumable');
        }
        if (item.stack <= 0) throw new BadRequestException('Empty stack');

        const effect = item.effect as unknown as ConsumableEffect;
        consumablePlan.push({ name: item.name, effect });

        if (item.stack > 1) {
          await tx.item.update({
            where: { id: item.id },
            data: { stack: item.stack - 1 },
          });
        } else {
          await tx.item.delete({ where: { id: item.id } });
        }
      }

      // Snapshot effective stats (base + equipped)
      const bonuses = await this.items.effectiveBonuses(heroId);
      const effective = this.items.applyBonusesTo(
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

      // Compute the combat now; store report
      const seed = `${hero.id}-${Date.now()}-${Math.floor(Math.random() * 0xffff)}`;
      const report = simulateCombat(
        { ...effective, name: hero.name },
        def.enemy,
        consumablePlan,
        seed,
      );

      const now = new Date();
      const finish = new Date(now.getTime() + def.durationSeconds * 1000);
      const run = await tx.missionRun.create({
        data: {
          heroId,
          missionCode,
          seed,
          startAt: now,
          finishAt: finish,
          status: 'PENDING',
          consumableItemIds: consumableItemIds as unknown as Prisma.InputJsonValue,
          report: report as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        runId: run.id,
        startAt: run.startAt.toISOString(),
        finishAt: run.finishAt.toISOString(),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Claim
  // -----------------------------------------------------------------------

  async claim(heroId: string, runId: string): Promise<CombatReport> {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.missionRun.findUnique({ where: { id: runId } });
      if (!run || run.heroId !== heroId) throw new NotFoundException('Run not found');
      if (run.status === 'CLAIMED') throw new ConflictException('Already claimed');
      if (new Date() < run.finishAt) throw new BadRequestException('Not finished yet');

      const def = missionByCode(run.missionCode);
      if (!def) throw new BadRequestException('Unknown mission');

      const report = run.report as unknown as CombatReport;
      let rewards: CombatRewards | null = null;

      if (report.outcome === 'VICTORY') {
        rewards = await this.applyRewards(tx, heroId, def);
      }

      await tx.missionRun.update({
        where: { id: run.id },
        data: {
          status: 'CLAIMED',
          report: { ...report, rewards } as unknown as Prisma.InputJsonValue,
        },
      });

      return { ...report, rewards };
    });
  }

  // -----------------------------------------------------------------------
  // Apply rewards (xp, level-ups, gold, resources, items)
  // -----------------------------------------------------------------------

  private async applyRewards(
    tx: Tx,
    heroId: string,
    def: MissionDef,
  ): Promise<CombatRewards> {
    // Gold
    await this.resources.add(heroId, 'GOLD', def.rewardGold, tx);

    // Resource drops
    const resourceRewards: Array<{ type: ResourceType; amount: number }> = [];
    for (const drop of def.resourceDrops) {
      if (Math.random() < drop.chance) {
        const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        if (amount > 0) {
          await this.resources.add(heroId, drop.type, amount, tx);
          resourceRewards.push({ type: drop.type, amount });
        }
      }
    }

    // Item drops (forged-style generation)
    const itemRewards: CombatRewardItem[] = [];
    for (const drop of def.itemDrops) {
      if (Math.random() < drop.chance) {
        const item = await this.items.generateForForgeTier(heroId, drop.forgeTier, tx);
        itemRewards.push({
          id: item.id,
          name: item.name,
          rarity: item.rarity,
          slot: item.slot,
          bonuses: item.bonuses,
        });
      }
    }

    // XP + level up
    const { levelUps, newLevel, newXp } = this.computeLevelUps(
      await tx.hero.findUniqueOrThrow({ where: { id: heroId } }),
      def.rewardXp,
    );

    await tx.hero.update({
      where: { id: heroId },
      data: {
        xp: newXp,
        level: newLevel,
        // baseline stat gains per level-up
        hp: { increment: LEVEL_UP_GAINS.hp * levelUps },
        mp: { increment: LEVEL_UP_GAINS.mp * levelUps },
        attack: { increment: LEVEL_UP_GAINS.attack * levelUps },
        defense: { increment: LEVEL_UP_GAINS.defense * levelUps },
        speed: { increment: LEVEL_UP_GAINS.speed * levelUps },
        unallocatedPoints: { increment: LEVEL_UP_FREE_POINTS * levelUps },
      },
    });

    return {
      xp: def.rewardXp,
      gold: def.rewardGold,
      levelUps,
      resources: resourceRewards,
      items: itemRewards,
    };
  }

  private computeLevelUps(
    hero: { level: number; xp: number },
    gainedXp: number,
  ): { levelUps: number; newLevel: number; newXp: number } {
    let level = hero.level;
    let xp = hero.xp + gainedXp;
    let levelUps = 0;
    while (xp >= xpForLevel(level + 1)) {
      xp -= xpForLevel(level + 1);
      level += 1;
      levelUps += 1;
      if (levelUps > 50) break; // safety
    }
    return { levelUps, newLevel: level, newXp: xp };
  }

  // -----------------------------------------------------------------------
  // List hero's consumable inventory (for loadout UI)
  // -----------------------------------------------------------------------

  async listConsumables(heroId: string): Promise<Item[]> {
    const all = await this.items.listByHero(heroId);
    return all.filter((i) => i.kind === 'CONSUMABLE');
  }

  // -----------------------------------------------------------------------
  // Catalog metadata (for consumable selection UX)
  // -----------------------------------------------------------------------

  getConsumableCatalog() {
    return CONSUMABLE_CATALOG;
  }
}
