import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RECIPE_CATALOG,
  UPGRADE_MAX_LEVEL,
  recipeByCode,
  salvageRefund,
  upgradeCost,
  upgradeSuccessChance,
  type Item,
  type ItemRarity,
  type ItemSlot,
  type ItemStatBonus,
  type RecipeDef,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from '../items/items.service';
import { ResourcesService } from '../resources/resources.service';

type Tx = Prisma.TransactionClient;

export interface UpgradeAttemptResult {
  success: boolean;
  newLevel: number;
  item: Item;
}

@Injectable()
export class ForgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
    private readonly resources: ResourcesService,
  ) {}

  // -----------------------------------------------------------------------
  // Blacksmith gate
  // -----------------------------------------------------------------------

  private async requireBlacksmith(heroId: string, tx: Tx = this.prisma) {
    const bs = await tx.companion.findUnique({
      where: { heroId_role: { heroId, role: 'BLACKSMITH' } },
    });
    if (!bs) throw new NotFoundException('Blacksmith companion missing');
    if (bs.state === 'LOCKED')
      throw new BadRequestException('Blacksmith must be unlocked first');
    return bs;
  }

  async blacksmithLevel(heroId: string): Promise<number> {
    const bs = await this.prisma.companion.findUnique({
      where: { heroId_role: { heroId, role: 'BLACKSMITH' } },
    });
    if (!bs || bs.state === 'LOCKED') return 0;
    return bs.level;
  }

  // -----------------------------------------------------------------------
  // Recipes
  // -----------------------------------------------------------------------

  async listRecipes(heroId: string): Promise<
    Array<RecipeDef & { unlocked: boolean; affordable: boolean }>
  > {
    const bs = await this.prisma.companion.findUnique({
      where: { heroId_role: { heroId, role: 'BLACKSMITH' } },
    });
    const bsLevel = bs && bs.state !== 'LOCKED' ? bs.level : 0;

    const owned = new Map<ResourceType, number>();
    const rows = await this.prisma.resource.findMany({ where: { heroId } });
    for (const r of rows) owned.set(r.type as ResourceType, r.amount);

    return RECIPE_CATALOG.map((r) => ({
      ...r,
      unlocked: bsLevel >= r.blacksmithLevel,
      affordable: Object.entries(r.cost).every(
        ([k, v]) => (owned.get(k as ResourceType) ?? 0) >= (v ?? 0),
      ),
    }));
  }

  async craftRecipe(heroId: string, code: string): Promise<Item> {
    const def = recipeByCode(code);
    if (!def) throw new BadRequestException('Unknown recipe');

    return this.prisma.$transaction(async (tx) => {
      const bs = await this.requireBlacksmith(heroId, tx);
      if (bs.level < def.blacksmithLevel) {
        throw new BadRequestException(
          `Recipe unlocks at Blacksmith level ${def.blacksmithLevel}`,
        );
      }

      for (const [k, v] of Object.entries(def.cost)) {
        if (v && v > 0) {
          await this.resources.add(heroId, k as ResourceType, -v, tx);
        }
      }

      const created = await tx.item.create({
        data: {
          heroId,
          kind: 'EQUIPMENT',
          name: def.output.name ?? def.name,
          slot: def.output.slot,
          rarity: def.output.rarity,
          bonuses: def.output.bonuses as unknown as Prisma.InputJsonValue,
        },
      });
      return this.itemDto(created);
    });
  }

  // -----------------------------------------------------------------------
  // Upgrade
  // -----------------------------------------------------------------------

  async upgrade(heroId: string, itemId: string): Promise<UpgradeAttemptResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.requireBlacksmith(heroId, tx);

      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item || item.heroId !== heroId) throw new NotFoundException('Item not found');
      if (item.kind !== 'EQUIPMENT') throw new BadRequestException('Only equipment can be upgraded');
      if (item.onMarket) throw new ConflictException('Item is on the market');
      if (item.upgradeLevel >= UPGRADE_MAX_LEVEL) {
        throw new BadRequestException('Already at max level');
      }

      const cost = upgradeCost(item.upgradeLevel);
      await this.resources.add(heroId, 'IRON', -cost.iron, tx);
      await this.resources.add(heroId, 'GEM', -cost.gem, tx);
      await this.resources.add(heroId, 'GOLD', -cost.gold, tx);

      const chance = upgradeSuccessChance(item.upgradeLevel);
      const success = Math.random() < chance;

      const updated = await tx.item.update({
        where: { id: item.id },
        data: success ? { upgradeLevel: item.upgradeLevel + 1 } : {},
      });

      return {
        success,
        newLevel: updated.upgradeLevel,
        item: this.itemDto(updated),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Salvage
  // -----------------------------------------------------------------------

  async salvage(
    heroId: string,
    itemId: string,
  ): Promise<{ refund: Partial<Record<ResourceType, number>> }> {
    return this.prisma.$transaction(async (tx) => {
      await this.requireBlacksmith(heroId, tx);

      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item || item.heroId !== heroId) throw new NotFoundException('Item not found');
      if (item.kind !== 'EQUIPMENT') throw new BadRequestException('Only equipment can be salvaged');
      if (item.equipped) throw new ConflictException('Unequip first');
      if (item.onMarket) throw new ConflictException('Item is on the market');

      const refund = salvageRefund(
        item.rarity as ItemRarity,
        item.upgradeLevel,
      );
      for (const [k, v] of Object.entries(refund)) {
        if (v && v > 0) {
          await this.resources.add(heroId, k as ResourceType, v, tx);
        }
      }
      await tx.item.delete({ where: { id: item.id } });
      return { refund };
    });
  }

  // -----------------------------------------------------------------------
  // Preview helpers (read-only)
  // -----------------------------------------------------------------------

  previewUpgrade(fromLevel: number) {
    return {
      cost: upgradeCost(fromLevel),
      successChance: upgradeSuccessChance(fromLevel),
      maxLevel: UPGRADE_MAX_LEVEL,
    };
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private itemDto(row: {
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
      kind: row.kind as Item['kind'],
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
