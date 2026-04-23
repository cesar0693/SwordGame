import type { HeroStats } from './hero.js';

export type ConsumableEffectType = 'HEAL_HP' | 'HEAL_MP' | 'BUFF';

export interface ConsumableEffect {
  /** Stable code used for stacking by name and for UI glyphs. */
  code: string;
  type: ConsumableEffectType;
  /** HP restored (HEAL_HP). */
  hp?: number;
  /** MP restored (HEAL_MP). */
  mp?: number;
  /** Stat buffed (BUFF). */
  stat?: keyof Omit<HeroStats, 'critFailChance'>;
  /** Flat amount added to the stat. */
  amount?: number;
  /** Turns the buff lasts. */
  durationTurns?: number;
}

export interface ConsumableSpec {
  code: string;
  name: string;
  description: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE';
  effect: ConsumableEffect;
}

/**
 * Catalog of consumables produced by the Alchemist and Baker.
 * The `code` here matches the companion track code so generation
 * can look the spec up directly.
 */
export const CONSUMABLE_CATALOG: Record<string, ConsumableSpec> = {
  POTION_MINOR: {
    code: 'POTION_MINOR',
    name: 'Potion de soin mineure',
    description: 'Restaure 40 PV.',
    rarity: 'COMMON',
    effect: { code: 'POTION_MINOR', type: 'HEAL_HP', hp: 40 },
  },
  POTION_GREATER: {
    code: 'POTION_GREATER',
    name: 'Potion de soin majeure',
    description: 'Restaure 100 PV.',
    rarity: 'UNCOMMON',
    effect: { code: 'POTION_GREATER', type: 'HEAL_HP', hp: 100 },
  },
  POTION_MANA: {
    code: 'POTION_MANA',
    name: 'Potion de mana',
    description: 'Restaure 50 PM.',
    rarity: 'COMMON',
    effect: { code: 'POTION_MANA', type: 'HEAL_MP', mp: 50 },
  },
  BREAD: {
    code: 'BREAD',
    name: 'Miche de pain',
    description: 'Restaure 20 PV.',
    rarity: 'COMMON',
    effect: { code: 'BREAD', type: 'HEAL_HP', hp: 20 },
  },
  CAKE: {
    code: 'CAKE',
    name: 'Gâteau fortifiant',
    description: '+5 ATQ pendant 3 tours.',
    rarity: 'UNCOMMON',
    effect: {
      code: 'CAKE',
      type: 'BUFF',
      stat: 'attack',
      amount: 5,
      durationTurns: 3,
    },
  },
};

export function consumableByCode(code: string): ConsumableSpec | null {
  return CONSUMABLE_CATALOG[code] ?? null;
}
