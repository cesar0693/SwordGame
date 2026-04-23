import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import { CompanionsService } from '../companions/companions.service';
import { ItemsService } from '../items/items.service';
import { SpellsService } from '../spells/spells.service';
import {
  ALLOCATION_VALUE_PER_POINT,
  BASE_STATS_BY_CLASS,
  STAT_ALLOCATIONS,
  xpForLevel,
  type AllocatableStat,
  type Hero,
  type HeroAppearance,
  type HeroClass,
  type HeroStats,
} from '@swordgame/shared';

type HeroRow = Awaited<ReturnType<PrismaService['hero']['findUnique']>>;

@Injectable()
export class HeroesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
    @Inject(forwardRef(() => CompanionsService))
    private readonly companions: CompanionsService,
    @Inject(forwardRef(() => ItemsService))
    private readonly items: ItemsService,
    private readonly spells: SpellsService,
  ) {}

  async create(
    userId: string,
    input: { name: string; heroClass: HeroClass; appearance: HeroAppearance },
  ): Promise<Hero> {
    const existing = await this.prisma.hero.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Hero already created for this user');
    }
    const nameTaken = await this.prisma.hero.findUnique({ where: { name: input.name } });
    if (nameTaken) {
      throw new ConflictException('Hero name already taken');
    }

    const base = BASE_STATS_BY_CLASS[input.heroClass];

    const hero = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hero.create({
        data: {
          userId,
          name: input.name,
          heroClass: input.heroClass,
          appearance: input.appearance as unknown as object,
          hp: base.hp,
          mp: base.mp,
          attack: base.attack,
          defense: base.defense,
          speed: base.speed,
          critChance: base.critChance,
          critFailChance: base.critFailChance,
          dodgeChance: base.dodgeChance,
        },
      });
      await this.resources.seed(created.id, tx);
      await this.companions.seed(created.id, tx);
      await this.spells.autoLearnForLevel(created.id, created.heroClass as HeroClass, created.level, tx);
      return created;
    });

    return this.toDto(hero);
  }

  async getByUser(userId: string): Promise<Hero | null> {
    const hero = await this.prisma.hero.findUnique({ where: { userId } });
    return hero ? await this.toDto(hero) : null;
  }

  async requireByUser(userId: string): Promise<Hero> {
    const hero = await this.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }

  async allocatePoint(userId: string, stat: AllocatableStat): Promise<Hero> {
    if (!(STAT_ALLOCATIONS as readonly string[]).includes(stat)) {
      throw new ConflictException('Invalid stat');
    }
    const hero = await this.prisma.hero.findUnique({ where: { userId } });
    if (!hero) throw new NotFoundException('Hero not found');
    if (hero.unallocatedPoints <= 0) {
      throw new ConflictException('No unspent points');
    }
    const value = ALLOCATION_VALUE_PER_POINT[stat];
    const updated = await this.prisma.hero.update({
      where: { id: hero.id },
      data: {
        unallocatedPoints: { decrement: 1 },
        [stat]: { increment: value },
      },
    });
    return this.toDto(updated);
  }

  private async toDto(row: NonNullable<HeroRow>): Promise<Hero> {
    const base: HeroStats = {
      hp: row.hp,
      mp: row.mp,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      critChance: row.critChance,
      critFailChance: row.critFailChance,
      dodgeChance: row.dodgeChance,
    };
    const bonuses = await this.items.effectiveBonuses(row.id);
    const effective = this.items.applyBonusesTo(base, bonuses);
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      heroClass: row.heroClass as HeroClass,
      level: row.level,
      xp: row.xp,
      xpToNext: xpForLevel(row.level + 1),
      stats: base,
      effectiveStats: effective,
      unallocatedPoints: row.unallocatedPoints,
      appearance: row.appearance as unknown as HeroAppearance,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
