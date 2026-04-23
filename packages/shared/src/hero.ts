export const HERO_CLASSES = ['WARRIOR', 'MAGE', 'RANGER'] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];

export interface HeroStats {
  hp: number;
  mp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;       // 0..1
  critFailChance: number;   // 0..1
  dodgeChance: number;      // 0..1
}

export interface HeroAppearance {
  skinTone: string;
  hair: string;
  eyes: string;
  outfit: string;
}

export interface Hero {
  id: string;
  userId: string;
  name: string;
  heroClass: HeroClass;
  level: number;
  xp: number;
  xpToNext: number;
  /** Base stats persisted on the hero (class + level-ups, no equipment). */
  stats: HeroStats;
  /** Stats after adding equipped item bonuses. */
  effectiveStats: HeroStats;
  unallocatedPoints: number;
  appearance: HeroAppearance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHeroRequest {
  name: string;
  heroClass: HeroClass;
  appearance: HeroAppearance;
}

export const BASE_STATS_BY_CLASS: Record<HeroClass, HeroStats> = {
  WARRIOR: {
    hp: 120, mp: 20, attack: 14, defense: 12, speed: 8,
    critChance: 0.08, critFailChance: 0.05, dodgeChance: 0.05,
  },
  MAGE: {
    hp: 80, mp: 80, attack: 18, defense: 6, speed: 10,
    critChance: 0.12, critFailChance: 0.08, dodgeChance: 0.07,
  },
  RANGER: {
    hp: 100, mp: 40, attack: 15, defense: 8, speed: 14,
    critChance: 0.15, critFailChance: 0.06, dodgeChance: 0.12,
  },
};

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.65));
}

/** Stat gains per level-up (baseline, before spending free points). */
export const LEVEL_UP_GAINS: HeroStats = {
  hp: 8,
  mp: 4,
  attack: 1,
  defense: 1,
  speed: 1,
  critChance: 0,
  critFailChance: 0,
  dodgeChance: 0,
};

/** Free stat points awarded per level-up. */
export const LEVEL_UP_FREE_POINTS = 3;

export const STAT_ALLOCATIONS = [
  'hp',
  'mp',
  'attack',
  'defense',
  'speed',
] as const;
export type AllocatableStat = (typeof STAT_ALLOCATIONS)[number];

export const ALLOCATION_COST_PER_POINT: Record<AllocatableStat, number> = {
  hp: 1,     // +5 HP per point (applied at server)
  mp: 1,     // +3 MP per point
  attack: 1, // +1 ATK per point
  defense: 1,
  speed: 1,
};

/** How much a stat gains per spent free point. */
export const ALLOCATION_VALUE_PER_POINT: Record<AllocatableStat, number> = {
  hp: 5,
  mp: 3,
  attack: 1,
  defense: 1,
  speed: 1,
};
