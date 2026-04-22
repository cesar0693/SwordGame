import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  COMPANION_CATALOG,
  COMPANION_ROLES,
  OFFLINE_CYCLE_CAP,
  type Companion,
  type CompanionRole,
  type CompanionState,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import {
  cycleModifiersFromPerks,
  levelForCycles,
  pendingPerkLevel,
} from './companions.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CompanionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
  ) {}

  // -----------------------------------------------------------------------
  // Seed
  // -----------------------------------------------------------------------

  /** Create one row per companion role for a new hero. */
  async seed(heroId: string, tx: Tx = this.prisma): Promise<void> {
    for (const role of COMPANION_ROLES) {
      const spec = COMPANION_CATALOG[role];
      const autoUnlock = spec.unlockHeroLevel <= 1 && this.costIsFree(spec.unlockCost);
      await tx.companion.upsert({
        where: { heroId_role: { heroId, role } },
        update: {},
        create: {
          heroId,
          role,
          state: autoUnlock ? 'IDLE' : 'LOCKED',
          unlockedAt: autoUnlock ? new Date() : null,
        },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Read
  // -----------------------------------------------------------------------

  async listByHero(heroId: string): Promise<Companion[]> {
    const rows = await this.prisma.companion.findMany({
      where: { heroId },
      include: { perks: true },
      orderBy: { role: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // -----------------------------------------------------------------------
  // Unlock
  // -----------------------------------------------------------------------

  async unlock(heroId: string, role: CompanionRole): Promise<Companion> {
    const spec = COMPANION_CATALOG[role];
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException('Hero not found');
    if (hero.level < spec.unlockHeroLevel) {
      throw new BadRequestException(
        `Requires hero level ${spec.unlockHeroLevel}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { perks: true },
      });
      if (!comp) throw new NotFoundException('Companion slot missing');
      if (comp.state !== 'LOCKED') {
        throw new ConflictException('Already unlocked');
      }

      for (const [type, cost] of Object.entries(spec.unlockCost)) {
        if (cost && cost > 0) {
          await this.resources.add(heroId, type as ResourceType, -cost, tx);
        }
      }

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: { state: 'IDLE', unlockedAt: new Date() },
        include: { perks: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Start cycle
  // -----------------------------------------------------------------------

  async startCycle(heroId: string, role: CompanionRole): Promise<Companion> {
    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { perks: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state === 'LOCKED') {
        throw new ConflictException('Companion is locked');
      }
      if (comp.state === 'WORKING') {
        throw new ConflictException('Already working');
      }
      if (comp.toolDurability <= 0) {
        throw new BadRequestException('Tool broken — repair first');
      }

      const perkCodes = comp.perks.map((p) => p.code);
      const pending = pendingPerkLevel(
        role as CompanionRole,
        comp.level,
        comp.perks.map((p) => p.level),
      );
      if (pending !== null) {
        throw new ConflictException(`Pending perk choice for level ${pending}`);
      }

      const spec = COMPANION_CATALOG[role];
      const mods = cycleModifiersFromPerks(perkCodes);
      const durationSec = Math.max(
        5,
        Math.round(spec.baseCycleSeconds * mods.speedMultiplier),
      );

      // Consume inputs upfront so cost is paid even if the player abandons.
      if (spec.baseInputs) {
        for (const [type, base] of Object.entries(spec.baseInputs)) {
          if (!base) continue;
          const amount = Math.max(1, Math.round(base * mods.inputMultiplier));
          await this.resources.add(heroId, type as ResourceType, -amount, tx);
        }
      }

      const now = new Date();
      const finish = new Date(now.getTime() + durationSec * 1000);
      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: {
          state: 'WORKING',
          cycleStartAt: now,
          cycleFinishAt: finish,
        },
        include: { perks: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Claim cycle (supports offline accumulation up to OFFLINE_CYCLE_CAP)
  // -----------------------------------------------------------------------

  async claim(heroId: string, role: CompanionRole): Promise<Companion> {
    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { perks: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state !== 'WORKING' || !comp.cycleFinishAt || !comp.cycleStartAt) {
        throw new ConflictException('No cycle to claim');
      }

      const now = new Date();
      if (now < comp.cycleFinishAt) {
        throw new BadRequestException('Cycle not finished yet');
      }

      const spec = COMPANION_CATALOG[role];
      const perkCodes = comp.perks.map((p) => p.code);
      const mods = cycleModifiersFromPerks(perkCodes);
      const durationSec = Math.max(
        5,
        Math.round(spec.baseCycleSeconds * mods.speedMultiplier),
      );

      // How many full cycles accumulated since cycleStartAt? (capped)
      const elapsedSec = Math.floor(
        (now.getTime() - comp.cycleStartAt.getTime()) / 1000,
      );
      const rawCycles = Math.floor(elapsedSec / durationSec);
      const cycles = Math.max(1, Math.min(rawCycles, OFFLINE_CYCLE_CAP));

      // Output: for now we credit resource-typed outputs. POTION / BREAD / ITEM
      // outputs become active in Phase 3 (inventory) / 5 (forge); we no-op.
      if (this.isResourceOutput(spec.baseOutput.type)) {
        const amountPerCycle = Math.max(
          1,
          Math.round(spec.baseOutput.amount * mods.quantityMultiplier),
        );
        await this.resources.add(
          heroId,
          spec.baseOutput.type as ResourceType,
          amountPerCycle * cycles,
          tx,
        );
      }

      // Durability wear and counters
      const wear = Math.round(mods.durabilityWear * cycles);
      const newCycles = comp.cyclesCompleted + cycles;
      const newLevel = levelForCycles(newCycles);

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: {
          state: 'IDLE',
          cycleStartAt: null,
          cycleFinishAt: null,
          cyclesCompleted: newCycles,
          level: newLevel,
          toolDurability: Math.max(0, comp.toolDurability - wear),
        },
        include: { perks: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Pick perk
  // -----------------------------------------------------------------------

  async pickPerk(
    heroId: string,
    role: CompanionRole,
    level: number,
    code: string,
  ): Promise<Companion> {
    const spec = COMPANION_CATALOG[role];
    const tier = spec.perkTiers.find((t) => t.level === level);
    if (!tier) throw new BadRequestException('Unknown perk tier');
    if (!tier.choices.some((c) => c.code === code)) {
      throw new BadRequestException('Invalid perk choice');
    }

    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { perks: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.level < level) throw new BadRequestException('Level not reached');
      if (comp.perks.some((p) => p.level === level)) {
        throw new ConflictException('Already picked at that level');
      }

      await tx.companionPerkPick.create({
        data: { companionId: comp.id, level, code },
      });
      const updated = await tx.companion.findUniqueOrThrow({
        where: { id: comp.id },
        include: { perks: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private costIsFree(cost: Partial<Record<string, number>>): boolean {
    return Object.values(cost).every((v) => !v || v <= 0);
  }

  private isResourceOutput(t: string): boolean {
    return ['WOOD', 'IRON', 'LEATHER', 'HERB', 'GOLD', 'GEM'].includes(t);
  }

  private toDto(
    row: Prisma.CompanionGetPayload<{ include: { perks: true } }>,
  ): Companion {
    const perks = row.perks.map((p) => ({ level: p.level, code: p.code }));
    const pending = pendingPerkLevel(
      row.role as CompanionRole,
      row.level,
      perks.map((p) => p.level),
    );
    return {
      id: row.id,
      heroId: row.heroId,
      role: row.role as CompanionRole,
      state: row.state as CompanionState,
      level: row.level,
      toolDurability: row.toolDurability,
      cycleStartAt: row.cycleStartAt?.toISOString() ?? null,
      cycleFinishAt: row.cycleFinishAt?.toISOString() ?? null,
      unlockedAt: row.unlockedAt?.toISOString() ?? null,
      perks,
      pendingPerkLevel: pending,
    };
  }
}
