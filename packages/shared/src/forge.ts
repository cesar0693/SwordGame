import type { ItemRarity, ItemSlot, ItemStatBonus } from './items.js';
import type { ResourceType } from './resources.js';

// ---------------------------------------------------------------------------
// Upgrade mechanics
// ---------------------------------------------------------------------------

export const UPGRADE_MAX_LEVEL = 10;

/** Bonus multiplier applied to all item bonuses at a given upgrade level. */
export function upgradeMultiplier(upgradeLevel: number): number {
  return 1 + 0.1 * Math.max(0, Math.min(UPGRADE_MAX_LEVEL, upgradeLevel));
}

/** Chance (0..1) that an upgrade attempt succeeds. */
export function upgradeSuccessChance(fromLevel: number): number {
  // Mapping: fromLevel 0 → 0.90 (attempt +1), 1 → 0.75, ..., 9 → 0.08
  const table = [0.9, 0.75, 0.6, 0.45, 0.3, 0.2, 0.15, 0.12, 0.1, 0.08];
  const i = Math.max(0, Math.min(table.length - 1, fromLevel));
  return table[i]!;
}

export interface UpgradeCost {
  iron: number;
  gem: number;
  gold: number;
}

export function upgradeCost(fromLevel: number): UpgradeCost {
  return {
    iron: 5 + fromLevel * 3,
    gem: Math.ceil((fromLevel + 1) / 2),
    gold: 20 + fromLevel * 15,
  };
}

// ---------------------------------------------------------------------------
// Salvage refunds
// ---------------------------------------------------------------------------

export const SALVAGE_TABLE: Record<ItemRarity, Partial<Record<ResourceType, number>>> = {
  COMMON:    { IRON: 2 },
  UNCOMMON:  { IRON: 4 },
  RARE:      { IRON: 8, GEM: 1 },
  EPIC:      { IRON: 15, GEM: 3 },
  LEGENDARY: { IRON: 30, GEM: 8 },
};

/** Adds a 25% resources bonus per upgrade level to the base table. */
export function salvageRefund(
  rarity: ItemRarity,
  upgradeLevel: number,
): Partial<Record<ResourceType, number>> {
  const base = SALVAGE_TABLE[rarity];
  const factor = 1 + 0.25 * upgradeLevel;
  const out: Partial<Record<ResourceType, number>> = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'number') {
      out[k as ResourceType] = Math.max(1, Math.round(v * factor));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export interface RecipeDef {
  code: string;
  name: string;
  description: string;
  /** Blacksmith level at which this recipe unlocks. */
  blacksmithLevel: number;
  cost: Partial<Record<ResourceType, number>>;
  output: {
    slot: ItemSlot;
    rarity: ItemRarity;
    bonuses: ItemStatBonus;
    /** Optional label shown instead of auto-naming. */
    name?: string;
  };
}

function recipe(
  code: string,
  name: string,
  description: string,
  blacksmithLevel: number,
  cost: Partial<Record<ResourceType, number>>,
  slot: ItemSlot,
  rarity: ItemRarity,
  bonuses: ItemStatBonus,
): RecipeDef {
  return { code, name, description, blacksmithLevel, cost, output: { slot, rarity, bonuses, name } };
}

export const RECIPE_CATALOG: RecipeDef[] = [
  // ---- Iron tier (Blacksmith level 1) ----
  recipe('IRON_SWORD', 'Épée en fer',
    'Arme solide et prévisible.',
    1, { IRON: 10, WOOD: 5, GOLD: 20 },
    'WEAPON', 'UNCOMMON', { attack: 6, critChance: 0.02 }),
  recipe('IRON_SHIELD', 'Bouclier en fer',
    'Bonne absorption, un peu lourd.',
    1, { IRON: 15, WOOD: 5, GOLD: 20 },
    'OFFHAND', 'UNCOMMON', { defense: 7, hp: 10 }),
  recipe('IRON_HELMET', 'Casque en fer',
    'Protection de base pour la tête.',
    1, { IRON: 8, GOLD: 15 },
    'HELMET', 'UNCOMMON', { hp: 15, defense: 3 }),
  recipe('IRON_ARMOR', 'Plastron en fer',
    'Torse protégé, mouvements ralentis.',
    1, { IRON: 20, LEATHER: 10, GOLD: 30 },
    'ARMOR', 'UNCOMMON', { hp: 25, defense: 6 }),
  recipe('IRON_BOOTS', 'Bottes ferrées',
    'Pas lourds mais sûrs.',
    1, { IRON: 8, LEATHER: 5, GOLD: 10 },
    'BOOTS', 'UNCOMMON', { speed: 2, defense: 2, hp: 8 }),

  // ---- Copper tier (Blacksmith level 3) ----
  recipe('COPPER_BLADE', 'Lame en cuivre',
    'Lame rapide, frappe à la tête.',
    3, { COPPER: 12, WOOD: 8, GOLD: 60 },
    'WEAPON', 'RARE', { attack: 10, critChance: 0.05, speed: 1 }),
  recipe('COPPER_BUCKLER', 'Rondache en cuivre',
    'Bouclier léger favorisant l\'esquive.',
    3, { COPPER: 14, LEATHER: 6, GOLD: 60 },
    'OFFHAND', 'RARE', { defense: 6, dodgeChance: 0.05 }),
  recipe('COPPER_RING', 'Anneau de cuivre',
    'Un petit plus sur toutes les stats.',
    3, { COPPER: 10, GEM: 1, GOLD: 100 },
    'RING', 'RARE', { attack: 3, defense: 3, speed: 1 }),

  // ---- Silver tier (Blacksmith level 5) ----
  recipe('SILVER_BLADE', 'Lame d\'argent',
    'Tranchante, charge mystique.',
    5, { SILVER: 15, COPPER: 8, GEM: 2, GOLD: 200 },
    'WEAPON', 'EPIC', { attack: 16, critChance: 0.08, speed: 2 }),
  recipe('SILVER_AMULET', 'Amulette d\'argent',
    'Bénédiction du forgeron ; PV et PM.',
    5, { SILVER: 10, GEM: 3, GOLD: 180 },
    'AMULET', 'EPIC', { hp: 25, mp: 15, defense: 4 }),
  recipe('SILVER_PLATE', 'Plastron d\'argent',
    'Défensif lourd mais résistant.',
    5, { SILVER: 20, COPPER: 10, LEATHER: 15, GOLD: 300 },
    'ARMOR', 'EPIC', { hp: 50, defense: 12 }),
];

export function recipeByCode(code: string): RecipeDef | null {
  return RECIPE_CATALOG.find((r) => r.code === code) ?? null;
}
