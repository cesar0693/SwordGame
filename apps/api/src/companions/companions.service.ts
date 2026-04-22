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
  FORGE_TIERS,
  OFFLINE_CYCLE_CAP,
  toolRepairCost,
  type Companion,
  type CompanionRole,
  type CompanionSkillSpend,
  type CompanionState,
  type ResourceType,
  type SkillAxis,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import { ItemsService } from '../items/items.service';
import {
  VALID_AXES,
  defaultTrackCode,
  levelForCycles,
  runtimeFor,
  trackByCode,
  trackUnlocked,
  unlockedTracks,
} from './companions.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CompanionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
    private readonly items: ItemsService,
  ) {}

  // -----------------------------------------------------------------------
  // Seed
  // -----------------------------------------------------------------------

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
          activeTrack: defaultTrackCode(role),
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
      include: { spends: true },
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
      throw new BadRequestException(`Requires hero level ${spec.unlockHeroLevel}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion slot missing');
      if (comp.state !== 'LOCKED') throw new ConflictException('Already unlocked');

      for (const [type, cost] of Object.entries(spec.unlockCost)) {
        if (cost && cost > 0) {
          await this.resources.add(heroId, type as ResourceType, -cost, tx);
        }
      }

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: {
          state: 'IDLE',
          unlockedAt: new Date(),
          activeTrack: comp.activeTrack || defaultTrackCode(role),
        },
        include: { spends: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Change active track
  // -----------------------------------------------------------------------

  async setActiveTrack(
    heroId: string,
    role: CompanionRole,
    trackCode: string,
  ): Promise<Companion> {
    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state === 'LOCKED') throw new ConflictException('Locked');
      if (comp.state === 'WORKING')
        throw new ConflictException('Cannot switch while working');
      if (!trackUnlocked(role, trackCode, comp.level))
        throw new BadRequestException('Track not unlocked');

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: { activeTrack: trackCode },
        include: { spends: true },
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
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state === 'LOCKED') throw new ConflictException('Locked');
      if (comp.state === 'WORKING') throw new ConflictException('Already working');
      if (comp.toolDurability <= 0)
        throw new BadRequestException('Tool broken — repair first');

      if (!trackUnlocked(role, comp.activeTrack, comp.level)) {
        // fall back to starter track if somehow desynced
        throw new BadRequestException('Active track is not unlocked');
      }

      const spec = COMPANION_CATALOG[role];
      const spends = this.spendsFrom(comp.spends);
      const rt = runtimeFor(role, comp.activeTrack, spends);
      if (!rt) throw new BadRequestException('Unknown track');

      // Consume inputs upfront
      if (spec.baseInputs) {
        for (const [type, base] of Object.entries(spec.baseInputs)) {
          if (!base) continue;
          await this.resources.add(heroId, type as ResourceType, -base, tx);
        }
      }

      const now = new Date();
      const finish = new Date(now.getTime() + rt.effectiveSeconds * 1000);
      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: { state: 'WORKING', cycleStartAt: now, cycleFinishAt: finish },
        include: { spends: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Claim cycle (with offline accumulation up to OFFLINE_CYCLE_CAP)
  // -----------------------------------------------------------------------

  async claim(heroId: string, role: CompanionRole): Promise<Companion> {
    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state !== 'WORKING' || !comp.cycleFinishAt || !comp.cycleStartAt) {
        throw new ConflictException('No cycle to claim');
      }

      const now = new Date();
      if (now < comp.cycleFinishAt) throw new BadRequestException('Cycle not finished yet');

      const spends = this.spendsFrom(comp.spends);
      const rt = runtimeFor(role, comp.activeTrack, spends);
      if (!rt) throw new BadRequestException('Unknown track');

      const elapsedSec = Math.floor((now.getTime() - comp.cycleStartAt.getTime()) / 1000);
      const rawCycles = Math.floor(elapsedSec / rt.effectiveSeconds);
      const cycles = Math.max(1, Math.min(rawCycles, OFFLINE_CYCLE_CAP));

      const t = trackByCode(role, comp.activeTrack);
      if (t && role === 'BLACKSMITH' && FORGE_TIERS[t.code]) {
        // Forge tracks produce equipment items (one per cycle).
        for (let i = 0; i < rt.effectiveAmount * cycles; i += 1) {
          await this.items.generateForForgeTier(heroId, t.code, tx);
        }
      } else if (t && this.isResource(t.resource)) {
        await this.resources.add(heroId, t.resource, rt.effectiveAmount * cycles, tx);
      }
      // Alchemist/Baker consumable outputs remain stubbed until Phase 4.

      // Durability wear per cycle (base 2)
      const wear = 2 * cycles;
      const newCycles = comp.cyclesCompleted + cycles;
      const newLevel = levelForCycles(newCycles);
      const pointsGained = Math.max(0, newLevel - comp.level);

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: {
          state: 'IDLE',
          cycleStartAt: null,
          cycleFinishAt: null,
          cyclesCompleted: newCycles,
          level: newLevel,
          toolDurability: Math.max(0, comp.toolDurability - wear),
          skillPointsUnspent: comp.skillPointsUnspent + pointsGained,
        },
        include: { spends: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Spend a skill point (QUANTITY or SPEED on a specific track)
  // -----------------------------------------------------------------------

  async spendSkill(
    heroId: string,
    role: CompanionRole,
    trackCode: string,
    axis: SkillAxis,
  ): Promise<Companion> {
    if (!VALID_AXES.includes(axis)) throw new BadRequestException('Invalid axis');

    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state === 'LOCKED') throw new ConflictException('Locked');
      if (comp.skillPointsUnspent <= 0) throw new BadRequestException('No skill point available');
      if (!trackUnlocked(role, trackCode, comp.level))
        throw new BadRequestException('Track not unlocked');

      await tx.companionSkillSpend.create({
        data: { companionId: comp.id, trackCode, axis },
      });
      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: { skillPointsUnspent: comp.skillPointsUnspent - 1 },
        include: { spends: true },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Repair tools (IRON cost scaled to missing durability)
  // -----------------------------------------------------------------------

  async repairTools(heroId: string, role: CompanionRole): Promise<Companion> {
    return this.prisma.$transaction(async (tx) => {
      const comp = await tx.companion.findUnique({
        where: { heroId_role: { heroId, role } },
        include: { spends: true },
      });
      if (!comp) throw new NotFoundException('Companion not found');
      if (comp.state === 'LOCKED') throw new ConflictException('Locked');
      if (comp.state === 'WORKING')
        throw new ConflictException('Cannot repair while working');
      if (comp.toolDurability >= 100)
        throw new BadRequestException('Tools already fully repaired');

      const missing = 100 - comp.toolDurability;
      const cost = toolRepairCost(missing);
      await this.resources.add(heroId, 'IRON', -cost, tx);

      const updated = await tx.companion.update({
        where: { id: comp.id },
        data: { toolDurability: 100 },
        include: { spends: true },
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

  private isResource(t: string): boolean {
    // All resource outputs from tracks; crafter tracks output item-like tokens
    // whose .resource entry is still a valid ResourceType (HERB/WHEAT/IRON),
    // but we only credit the resource if the track truly produces it.
    // For now, all producer tracks' resource = their output. Crafters have
    // non-producer tracks (POTION_MINOR etc.) whose `resource` is an ingredient;
    // we skip crediting because Phase 3 handles item inventory.
    return [
      'GOLD', 'IRON', 'COPPER', 'SILVER', 'GEM',
      'WOOD', 'OAK', 'IRONWOOD',
      'WHEAT', 'CORN',
      'HERB', 'MUSHROOM', 'FLOWER',
      'LEATHER',
    ].includes(t);
  }

  private spendsFrom(
    rows: Array<{ trackCode: string; axis: string }>,
  ): CompanionSkillSpend[] {
    return rows.map((r) => ({ trackCode: r.trackCode, axis: r.axis as SkillAxis }));
  }

  private toDto(
    row: Prisma.CompanionGetPayload<{ include: { spends: true } }>,
  ): Companion {
    const role = row.role as CompanionRole;
    const spec = COMPANION_CATALOG[role];
    const spends = this.spendsFrom(row.spends);
    const unlocked = unlockedTracks(spec, row.level).map((t) => t.code);
    return {
      id: row.id,
      heroId: row.heroId,
      role,
      state: row.state as CompanionState,
      level: row.level,
      cyclesCompleted: row.cyclesCompleted,
      toolDurability: row.toolDurability,
      activeTrack: row.activeTrack || defaultTrackCode(role),
      skillPointsUnspent: row.skillPointsUnspent,
      cycleStartAt: row.cycleStartAt?.toISOString() ?? null,
      cycleFinishAt: row.cycleFinishAt?.toISOString() ?? null,
      unlockedAt: row.unlockedAt?.toISOString() ?? null,
      spends,
      unlockedTrackCodes: unlocked,
    };
  }
}
