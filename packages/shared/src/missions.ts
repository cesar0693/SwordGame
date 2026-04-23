import type { HeroStats } from './hero.js';
import type { ResourceType } from './resources.js';

export interface EnemyStats extends HeroStats {
  name: string;
}

export interface ResourceDrop {
  type: ResourceType;
  min: number;
  max: number;
  chance: number; // 0..1
}

export interface ItemDrop {
  forgeTier: 'IRON_GEAR' | 'COPPER_GEAR' | 'SILVER_GEAR';
  chance: number; // 0..1
}

export interface MissionDef {
  code: string;
  name: string;
  description: string;
  minHeroLevel: number;
  durationSeconds: number;
  enemy: EnemyStats;
  rewardXp: number;
  rewardGold: number;
  /** Only rolled on victory. */
  resourceDrops: ResourceDrop[];
  itemDrops: ItemDrop[];
}

function enemy(
  name: string,
  hp: number,
  attack: number,
  defense: number,
  speed: number,
  critChance = 0.05,
  dodgeChance = 0.05,
): EnemyStats {
  return {
    name,
    hp,
    mp: 0,
    attack,
    defense,
    speed,
    critChance,
    critFailChance: 0.1,
    dodgeChance,
  };
}

export const MISSION_CATALOG: MissionDef[] = [
  {
    code: 'GOBLIN_PATROL',
    name: 'Patrouille gobeline',
    description: "Un éclaireur gobelin rôde près du camp.",
    minHeroLevel: 1,
    durationSeconds: 60,
    enemy: enemy('Gobelin éclaireur', 60, 10, 3, 8),
    rewardXp: 30,
    rewardGold: 15,
    resourceDrops: [
      { type: 'LEATHER', min: 1, max: 3, chance: 0.7 },
      { type: 'WOOD', min: 2, max: 5, chance: 0.5 },
    ],
    itemDrops: [],
  },
  {
    code: 'WOLF_HUNT',
    name: 'Meute de loups',
    description: 'Des loups affamés harcèlent la forêt.',
    minHeroLevel: 2,
    durationSeconds: 120,
    enemy: enemy('Loup enragé', 110, 14, 5, 12, 0.08, 0.08),
    rewardXp: 70,
    rewardGold: 35,
    resourceDrops: [
      { type: 'LEATHER', min: 3, max: 6, chance: 0.9 },
      { type: 'HERB', min: 1, max: 3, chance: 0.4 },
    ],
    itemDrops: [{ forgeTier: 'IRON_GEAR', chance: 0.15 }],
  },
  {
    code: 'BANDIT_CAMP',
    name: 'Campement de bandits',
    description: 'Des bandits rançonnent les voyageurs.',
    minHeroLevel: 4,
    durationSeconds: 240,
    enemy: enemy('Chef de bandits', 180, 20, 10, 10, 0.1, 0.06),
    rewardXp: 160,
    rewardGold: 90,
    resourceDrops: [
      { type: 'LEATHER', min: 4, max: 8, chance: 0.7 },
      { type: 'IRON', min: 2, max: 5, chance: 0.6 },
    ],
    itemDrops: [{ forgeTier: 'IRON_GEAR', chance: 0.3 }],
  },
  {
    code: 'ABANDONED_MINE',
    name: 'Mine abandonnée',
    description: 'Des squelettes infestent la mine désaffectée.',
    minHeroLevel: 5,
    durationSeconds: 300,
    enemy: enemy('Seigneur squelette', 240, 24, 14, 9, 0.08, 0.04),
    rewardXp: 230,
    rewardGold: 130,
    resourceDrops: [
      { type: 'IRON', min: 5, max: 10, chance: 0.9 },
      { type: 'COPPER', min: 2, max: 5, chance: 0.5 },
      { type: 'GEM', min: 1, max: 1, chance: 0.1 },
    ],
    itemDrops: [{ forgeTier: 'COPPER_GEAR', chance: 0.25 }],
  },
  {
    code: 'FOREST_WITCH',
    name: 'Sorcière des bois',
    description: 'Une sorcière trouble le sommeil de la forêt.',
    minHeroLevel: 7,
    durationSeconds: 420,
    enemy: enemy('Sorcière', 300, 30, 12, 13, 0.15, 0.1),
    rewardXp: 400,
    rewardGold: 240,
    resourceDrops: [
      { type: 'HERB', min: 8, max: 15, chance: 0.95 },
      { type: 'MUSHROOM', min: 3, max: 6, chance: 0.7 },
      { type: 'GEM', min: 1, max: 2, chance: 0.2 },
    ],
    itemDrops: [{ forgeTier: 'COPPER_GEAR', chance: 0.35 }],
  },
  {
    code: 'DRAGON_WHELP',
    name: 'Dragonnet',
    description: 'Un jeune dragon a fait son nid dans les collines.',
    minHeroLevel: 10,
    durationSeconds: 600,
    enemy: enemy('Dragonnet', 500, 40, 20, 14, 0.2, 0.12),
    rewardXp: 800,
    rewardGold: 550,
    resourceDrops: [
      { type: 'GEM', min: 2, max: 5, chance: 0.85 },
      { type: 'SILVER', min: 3, max: 6, chance: 0.6 },
    ],
    itemDrops: [{ forgeTier: 'SILVER_GEAR', chance: 0.5 }],
  },
];

export function missionByCode(code: string): MissionDef | null {
  return MISSION_CATALOG.find((m) => m.code === code) ?? null;
}
