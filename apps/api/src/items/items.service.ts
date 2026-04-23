import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONSUMABLE_CATALOG,
  upgradeMultiplier,
  type HeroStats,
  type Item,
  type ItemKind,
  type ItemRarity,
  type ItemSlot,
  type ItemStatBonus,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SeededRandom, rollEquipment } from './items.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByHero(heroId: string): Promise<Item[]> {
    const rows = await this.prisma.item.findMany({
      where: { heroId },
      orderBy: [{ equipped: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async equip(heroId: string, itemId: string): Promise<Item> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item || item.heroId !== heroId) {
        throw new NotFoundException('Item not found');
      }
      if (item.kind !== 'EQUIPMENT' || !item.slot) {
        throw new BadRequestException('Only equipment can be equipped');
      }
      if (item.equipped) throw new ConflictException('Already equipped');
      if (item.onMarket)
        throw new ConflictException('Item is listed on the market');

      // unequip any existing item in that slot
      await tx.item.updateMany({
        where: { heroId, slot: item.slot, equipped: true },
        data: { equipped: false },
      });

      const updated = await tx.item.update({
        where: { id: itemId },
        data: { equipped: true },
      });
      return this.toDto(updated);
    });
  }

  async unequip(heroId: string, itemId: string): Promise<Item> {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.heroId !== heroId) throw new NotFoundException('Item not found');
    if (!item.equipped) throw new ConflictException('Not equipped');

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data: { equipped: false },
    });
    return this.toDto(updated);
  }

  async drop(heroId: string, itemId: string): Promise<void> {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.heroId !== heroId) throw new NotFoundException('Item not found');
    if (item.equipped) throw new ConflictException('Unequip first');
    if (item.onMarket)
      throw new ConflictException('Cancel the market listing first');
    await this.prisma.item.delete({ where: { id: itemId } });
  }

  /**
   * Add N consumables of a given catalog code to a hero's inventory.
   * Stacks onto an existing row (by name) when possible.
   */
  async grantConsumable(
    heroId: string,
    code: string,
    amount: number,
    tx: Tx = this.prisma,
  ): Promise<Item> {
    const spec = CONSUMABLE_CATALOG[code];
    if (!spec) throw new Error(`Unknown consumable code: ${code}`);
    if (amount <= 0) throw new Error('amount must be > 0');

    // Try to stack onto an existing row with the same name (same spec).
    const existing = await tx.item.findFirst({
      where: { heroId, kind: 'CONSUMABLE', name: spec.name },
    });
    if (existing) {
      const updated = await tx.item.update({
        where: { id: existing.id },
        data: { stack: existing.stack + amount },
      });
      return this.toDto(updated);
    }
    const created = await tx.item.create({
      data: {
        heroId,
        kind: 'CONSUMABLE',
        name: spec.name,
        slot: null,
        rarity: spec.rarity,
        bonuses: {} as unknown as Prisma.InputJsonValue,
        stack: amount,
        effect: spec.effect as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(created);
  }

  /** Generate + persist one equipment item for the given blacksmith track. */
  async generateForForgeTier(
    heroId: string,
    tierCode: string,
    tx: Tx = this.prisma,
  ): Promise<Item> {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const rolled = rollEquipment(tierCode, new SeededRandom(seed));
    const created = await tx.item.create({
      data: {
        heroId,
        kind: 'EQUIPMENT',
        name: rolled.name,
        slot: rolled.slot,
        rarity: rolled.rarity,
        bonuses: rolled.bonuses as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(created);
  }

  /**
   * Sum of equipped item bonuses for effective stat computation,
   * scaled by each item's upgrade multiplier.
   */
  async effectiveBonuses(heroId: string): Promise<ItemStatBonus> {
    const equipped = await this.prisma.item.findMany({
      where: { heroId, equipped: true },
      select: { bonuses: true, upgradeLevel: true },
    });
    const total: ItemStatBonus = {};
    for (const row of equipped) {
      const b = (row.bonuses ?? {}) as ItemStatBonus;
      const mult = upgradeMultiplier(row.upgradeLevel);
      for (const key of Object.keys(b) as Array<keyof ItemStatBonus>) {
        const v = b[key];
        if (typeof v !== 'number') continue;
        const scaled = v * mult;
        // Keep pct stats in their 0..1 space; round ints, keep 4 decimals on pct
        const isPct = key === 'critChance' || key === 'dodgeChance';
        const finalVal = isPct
          ? Math.round(scaled * 10000) / 10000
          : Math.round(scaled);
        total[key] = (total[key] ?? 0) + finalVal;
      }
    }
    return total;
  }

  applyBonusesTo(base: HeroStats, bonuses: ItemStatBonus): HeroStats {
    return {
      hp: base.hp + (bonuses.hp ?? 0),
      mp: base.mp + (bonuses.mp ?? 0),
      attack: base.attack + (bonuses.attack ?? 0),
      defense: base.defense + (bonuses.defense ?? 0),
      speed: base.speed + (bonuses.speed ?? 0),
      critChance: Math.min(1, base.critChance + (bonuses.critChance ?? 0)),
      critFailChance: base.critFailChance,
      dodgeChance: Math.min(1, base.dodgeChance + (bonuses.dodgeChance ?? 0)),
    };
  }

  private toDto(row: {
    id: string;
    heroId: string;
    kind: string;
    name: string;
    slot: string | null;
    rarity: string;
    upgradeLevel: number;
    bonuses: unknown;
    equipped: boolean;
    onMarket: boolean;
    stack: number;
    effect: unknown;
    durationSeconds: number | null;
    createdAt: Date;
  }): Item {
    return {
      id: row.id,
      heroId: row.heroId,
      kind: row.kind as ItemKind,
      name: row.name,
      slot: (row.slot as ItemSlot | null) ?? null,
      rarity: row.rarity as ItemRarity,
      upgradeLevel: row.upgradeLevel,
      bonuses: (row.bonuses ?? {}) as ItemStatBonus,
      equipped: row.equipped,
      onMarket: row.onMarket,
      stack: row.stack,
      effect: (row.effect as Record<string, unknown> | null) ?? null,
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
