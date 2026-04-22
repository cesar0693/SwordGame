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
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  upgradeLevel: number;
  bonuses: ItemStatBonus;
  equipped: boolean;
}
