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
import {
  BASE_STATS_BY_CLASS,
  xpForLevel,
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
      return created;
    });

    return this.toDto(hero);
  }

  async getByUser(userId: string): Promise<Hero | null> {
    const hero = await this.prisma.hero.findUnique({ where: { userId } });
    return hero ? this.toDto(hero) : null;
  }

  async requireByUser(userId: string): Promise<Hero> {
    const hero = await this.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }

  private toDto(row: NonNullable<HeroRow>): Hero {
    const stats: HeroStats = {
      hp: row.hp,
      mp: row.mp,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      critChance: row.critChance,
      critFailChance: row.critFailChance,
      dodgeChance: row.dodgeChance,
    };
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      heroClass: row.heroClass as HeroClass,
      level: row.level,
      xp: row.xp,
      xpToNext: xpForLevel(row.level + 1),
      stats,
      unallocatedPoints: row.unallocatedPoints,
      appearance: row.appearance as unknown as HeroAppearance,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
