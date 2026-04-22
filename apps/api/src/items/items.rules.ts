import {
  FORGE_TIERS,
  ITEM_SLOTS,
  RARITY_BONUS_COUNT,
  RARITY_MULTIPLIER,
  RARITY_WEIGHTS,
  RARITY_LABEL,
  SLOT_ALLOWED_BONUSES,
  SLOT_LABEL,
  isPctStat,
  type ForgeTier,
  type ItemRarity,
  type ItemSlot,
  type ItemStatBonus,
} from '@swordgame/shared';

/** Simple seeded RNG for reproducible rolls (xorshift32). */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = (seed | 0) || 0x9e3779b9;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return ((x >>> 0) / 0xffffffff);
  }
  int(min: number, maxExclusive: number): number {
    return min + Math.floor(this.next() * (maxExclusive - min));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)]!;
  }
  weighted<T>(pairs: Array<[T, number]>): T {
    const total = pairs.reduce((a, [, w]) => a + w, 0);
    let r = this.next() * total;
    for (const [item, w] of pairs) {
      r -= w;
      if (r <= 0) return item;
    }
    return pairs[pairs.length - 1]![0];
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/** Generate a full equipment item rolled for the given forge tier. */
export interface GeneratedItem {
  name: string;
  kind: 'EQUIPMENT';
  slot: ItemSlot;
  rarity: ItemRarity;
  bonuses: ItemStatBonus;
}

export function rollEquipment(tierCode: string, rng: SeededRandom): GeneratedItem {
  const tier: ForgeTier | undefined = FORGE_TIERS[tierCode];
  if (!tier) throw new Error(`Unknown forge tier: ${tierCode}`);

  const rarity = rng.weighted(RARITY_WEIGHTS);
  const slot = rng.pick(ITEM_SLOTS);
  const allowedKeys = SLOT_ALLOWED_BONUSES[slot];
  const bonusCount = Math.min(RARITY_BONUS_COUNT[rarity], allowedKeys.length);

  // Sample distinct bonus keys for this item.
  const keys = [...allowedKeys];
  const chosen: Array<keyof ItemStatBonus> = [];
  for (let i = 0; i < bonusCount; i += 1) {
    const idx = rng.int(0, keys.length);
    chosen.push(keys.splice(idx, 1)[0]!);
  }

  const rarityMult = RARITY_MULTIPLIER[rarity];
  const bonuses: ItemStatBonus = {};
  for (const key of chosen) {
    if (isPctStat(key)) {
      const v = tier.baseValuePct * rarityMult * rng.range(0.8, 1.25);
      // round to 2 decimals percentage
      bonuses[key] = Math.round(v * 10000) / 10000;
    } else {
      const v = tier.baseValueInt * rarityMult * rng.range(0.8, 1.25);
      bonuses[key] = Math.max(1, Math.round(v));
    }
  }

  const name = `${RARITY_LABEL[rarity]} ${SLOT_LABEL[slot]} en ${materialName(tier.material)}`;
  return { name, kind: 'EQUIPMENT', slot, rarity, bonuses };
}

function materialName(mat: string): string {
  return { IRON: 'fer', COPPER: 'cuivre', SILVER: 'argent' }[mat] ?? mat.toLowerCase();
}
