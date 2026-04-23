import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MAX_EQUIPPED_SPELLS,
  learnableSpells,
  spellByCode,
  type HeroClass,
  type HeroSpell,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SpellsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByHero(heroId: string): Promise<HeroSpell[]> {
    const rows = await this.prisma.heroSpell.findMany({
      where: { heroId },
      orderBy: { learnedAt: 'asc' },
    });
    return rows.map((r) => ({
      code: r.spellCode,
      equipped: r.equipped,
      learnedAt: r.learnedAt.toISOString(),
    }));
  }

  /** Equipped spell codes — used by the combat engine. */
  async equippedCodes(heroId: string, tx: Tx = this.prisma): Promise<string[]> {
    const rows = await tx.heroSpell.findMany({
      where: { heroId, equipped: true },
      select: { spellCode: true },
    });
    return rows.map((r) => r.spellCode);
  }

  async equip(heroId: string, code: string): Promise<HeroSpell[]> {
    if (!spellByCode(code)) throw new BadRequestException('Unknown spell');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.heroSpell.findUnique({
        where: { heroId_spellCode: { heroId, spellCode: code } },
      });
      if (!row) throw new NotFoundException('Spell not learned yet');
      if (row.equipped) throw new ConflictException('Already equipped');

      const equippedCount = await tx.heroSpell.count({
        where: { heroId, equipped: true },
      });
      if (equippedCount >= MAX_EQUIPPED_SPELLS) {
        throw new ConflictException(
          `Up to ${MAX_EQUIPPED_SPELLS} spells can be equipped`,
        );
      }

      await tx.heroSpell.update({
        where: { id: row.id },
        data: { equipped: true },
      });
      return this.listByHeroTx(heroId, tx);
    });
  }

  async unequip(heroId: string, code: string): Promise<HeroSpell[]> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.heroSpell.findUnique({
        where: { heroId_spellCode: { heroId, spellCode: code } },
      });
      if (!row) throw new NotFoundException('Spell not learned');
      if (!row.equipped) throw new ConflictException('Not equipped');
      await tx.heroSpell.update({
        where: { id: row.id },
        data: { equipped: false },
      });
      return this.listByHeroTx(heroId, tx);
    });
  }

  /** Auto-learn any class spell whose learnAtLevel <= newLevel. Idempotent. */
  async autoLearnForLevel(
    heroId: string,
    heroClass: HeroClass,
    heroLevel: number,
    tx: Tx = this.prisma,
  ): Promise<number> {
    const eligible = learnableSpells(heroClass, heroLevel);
    let newlyLearned = 0;
    for (const spell of eligible) {
      const existing = await tx.heroSpell.findUnique({
        where: { heroId_spellCode: { heroId, spellCode: spell.code } },
      });
      if (!existing) {
        await tx.heroSpell.create({
          data: { heroId, spellCode: spell.code, equipped: false },
        });
        newlyLearned += 1;
      }
    }
    return newlyLearned;
  }

  private async listByHeroTx(heroId: string, tx: Tx): Promise<HeroSpell[]> {
    const rows = await tx.heroSpell.findMany({
      where: { heroId },
      orderBy: { learnedAt: 'asc' },
    });
    return rows.map((r) => ({
      code: r.spellCode,
      equipped: r.equipped,
      learnedAt: r.learnedAt.toISOString(),
    }));
  }
}
