import type { ResourceType } from './resources.js';

export const ITEM_SLOTS = [
  'WEAPON',
  'OFFHAND',
  'HELMET',
  'ARMOR',
  'BOOTS',
  'RING',
  'AMULET',
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const ITEM_RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const ITEM_KINDS = ['EQUIPMENT', 'CONSUMABLE'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export interface ItemStatBonus {
  hp?: number;
  mp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  critChance?: number;
  dodgeChance?: number;
}

export interface Item {
  id: string;
  heroId: string;
  kind: ItemKind;
  name: string;
  slot: ItemSlot | null;
  rarity: ItemRarity;
  upgradeLevel: number;
  bonuses: ItemStatBonus;
  equipped: boolean;
  stack: number;
  effect: Record<string, unknown> | null;
  durationSeconds: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const RARITY_LABEL: Record<ItemRarity, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Peu commun',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

export const SLOT_LABEL: Record<ItemSlot, string> = {
  WEAPON: 'Arme',
  OFFHAND: 'Main secondaire',
  HELMET: 'Casque',
  ARMOR: 'Armure',
  BOOTS: 'Bottes',
  RING: 'Anneau',
  AMULET: 'Amulette',
};

export const RARITY_COLOR: Record<ItemRarity, string> = {
  COMMON: '#b6a88e',
  UNCOMMON: '#6ab45e',
  RARE: '#4fa9e6',
  EPIC: '#b27de8',
  LEGENDARY: '#ffae3b',
};

export const STAT_LABEL: Record<keyof ItemStatBonus, string> = {
  hp: 'PV',
  mp: 'PM',
  attack: 'ATQ',
  defense: 'DEF',
  speed: 'VIT',
  critChance: 'Crit %',
  dodgeChance: 'Esquive %',
};

// ---------------------------------------------------------------------------
// Generation tables
// ---------------------------------------------------------------------------

/** Rarity roll weights (sum = 1000). */
export const RARITY_WEIGHTS: Array<[ItemRarity, number]> = [
  ['COMMON', 900],
  ['UNCOMMON', 80],
  ['RARE', 15],
  ['EPIC', 4],
  ['LEGENDARY', 1],
];

/** How many bonus lines on a rolled item by rarity. */
export const RARITY_BONUS_COUNT: Record<ItemRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
};

/** Rarity multiplier applied to base bonus value. */
export const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  COMMON: 1,
  UNCOMMON: 1.5,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 5,
};

/** Which bonuses a given slot can roll. */
export const SLOT_ALLOWED_BONUSES: Record<ItemSlot, Array<keyof ItemStatBonus>> = {
  WEAPON:  ['attack', 'critChance', 'speed'],
  OFFHAND: ['defense', 'dodgeChance', 'mp'],
  HELMET:  ['hp', 'mp', 'defense'],
  ARMOR:   ['hp', 'defense', 'dodgeChance'],
  BOOTS:   ['speed', 'dodgeChance', 'hp'],
  RING:    ['attack', 'defense', 'critChance', 'dodgeChance', 'hp', 'mp', 'speed'],
  AMULET:  ['attack', 'defense', 'critChance', 'dodgeChance', 'hp', 'mp', 'speed'],
};

/** Per-tier base value for a +1 rolled bonus line. */
export interface ForgeTier {
  code: string;            // blacksmith track code
  tierIndex: number;       // 1..N
  material: ResourceType;
  baseValueInt: number;    // for hp/mp/attack/defense/speed
  baseValuePct: number;    // for critChance/dodgeChance (0..1)
}

export const FORGE_TIERS: Record<string, ForgeTier> = {
  IRON_GEAR:   { code: 'IRON_GEAR',   tierIndex: 1, material: 'IRON',   baseValueInt: 3, baseValuePct: 0.01 },
  COPPER_GEAR: { code: 'COPPER_GEAR', tierIndex: 2, material: 'COPPER', baseValueInt: 6, baseValuePct: 0.02 },
  SILVER_GEAR: { code: 'SILVER_GEAR', tierIndex: 3, material: 'SILVER', baseValueInt: 10, baseValuePct: 0.03 },
};

/** Flat keys that use integer scale vs percentage scale. */
export function isPctStat(k: keyof ItemStatBonus): boolean {
  return k === 'critChance' || k === 'dodgeChance';
}

/** Tool repair cost for a companion (flat-iron cost scaled by missing durability). */
export function toolRepairCost(missingDurability: number): number {
  // 1 IRON per 10 missing durability, min 1 (only if there IS missing durability).
  if (missingDurability <= 0) return 0;
  return Math.max(1, Math.ceil(missingDurability / 10));
}
