import type { ResourceType } from './resources.js';

export const COMPANION_ROLES = [
  'MINER',
  'WOODCUTTER',
  'FARMER',
  'GATHERER',
  'ALCHEMIST',
  'BAKER',
  'BLACKSMITH',
] as const;
export type CompanionRole = (typeof COMPANION_ROLES)[number];

export type CompanionState = 'LOCKED' | 'IDLE' | 'WORKING';

export type SkillAxis = 'QUANTITY' | 'SPEED';

/**
 * A ResourceTrack is one output path a companion can work on.
 * Each track unlocks at a specific COMPANION level; later tracks
 * have slower base cycles and smaller base quantities on purpose.
 * The player then uses skill points to boost QUANTITY or SPEED
 * of a specific track.
 */
export interface ResourceTrack {
  code: string;
  resource: ResourceType;
  unlockAtLevel: number;
  baseCycleSeconds: number;
  baseOutput: number;
}

export interface CompanionSpec {
  role: CompanionRole;
  name: string;
  tagline: string;
  unlockHeroLevel: number;
  unlockCost: Partial<Record<ResourceType, number>>;
  /** Ordered list of tracks. tracks[0] is always unlocked at companion level 1. */
  tracks: ResourceTrack[];
  /** Inputs consumed per cycle (applies to all tracks for now). */
  baseInputs?: Partial<Record<ResourceType, number>>;
}

function track(
  code: string,
  resource: ResourceType,
  unlockAtLevel: number,
  baseCycleSeconds: number,
  baseOutput: number,
): ResourceTrack {
  return { code, resource, unlockAtLevel, baseCycleSeconds, baseOutput };
}

export const COMPANION_CATALOG: Record<CompanionRole, CompanionSpec> = {
  MINER: {
    role: 'MINER',
    name: 'Mineur',
    tagline: 'Extrait les minerais de la vallée.',
    unlockHeroLevel: 1,
    unlockCost: {},
    tracks: [
      track('IRON',   'IRON',   1, 60,  8),
      track('COPPER', 'COPPER', 3, 100, 5),
      track('SILVER', 'SILVER', 5, 180, 3),
      track('GEM',    'GEM',    7, 300, 1),
    ],
  },
  WOODCUTTER: {
    role: 'WOODCUTTER',
    name: 'Bûcheron',
    tagline: 'Abat les arbres autour du camp.',
    unlockHeroLevel: 1,
    unlockCost: {},
    tracks: [
      track('WOOD',     'WOOD',     1, 45,  10),
      track('OAK',      'OAK',      3, 90,  6),
      track('IRONWOOD', 'IRONWOOD', 6, 180, 3),
    ],
  },
  FARMER: {
    role: 'FARMER',
    name: 'Paysan',
    tagline: 'Cultive céréales et légumes pour nourrir le camp.',
    unlockHeroLevel: 3,
    unlockCost: { GOLD: 50, WOOD: 40 },
    tracks: [
      track('WHEAT', 'WHEAT', 1, 90,  6),
      track('CORN',  'CORN',  4, 160, 4),
    ],
  },
  GATHERER: {
    role: 'GATHERER',
    name: 'Récolteur',
    tagline: 'Cueille plantes et champignons dans la forêt.',
    unlockHeroLevel: 3,
    unlockCost: { GOLD: 50, LEATHER: 10 },
    tracks: [
      track('HERB',     'HERB',     1, 75,  7),
      track('MUSHROOM', 'MUSHROOM', 3, 130, 4),
      track('FLOWER',   'FLOWER',   5, 200, 2),
    ],
  },
  ALCHEMIST: {
    role: 'ALCHEMIST',
    name: 'Alchimiste',
    tagline: 'Prépare des potions de soin, mana ou boost.',
    unlockHeroLevel: 5,
    unlockCost: { GOLD: 150, WOOD: 60, IRON: 20 },
    tracks: [
      // Phase 3 will credit these into an inventory; for now the companion
      // still levels up but the output item is not persisted.
      track('POTION_MINOR',   'HERB', 1, 120, 1),
      track('POTION_GREATER', 'HERB', 4, 240, 1),
    ],
    baseInputs: { HERB: 4 },
  },
  BAKER: {
    role: 'BAKER',
    name: 'Boulanger',
    tagline: 'Cuit pain et pâtisseries (régen PV hors combat).',
    unlockHeroLevel: 5,
    unlockCost: { GOLD: 120, WOOD: 40 },
    tracks: [
      track('BREAD', 'WHEAT', 1, 100, 2),
      track('CAKE',  'WHEAT', 4, 200, 1),
    ],
    baseInputs: { WHEAT: 2 },
  },
  BLACKSMITH: {
    role: 'BLACKSMITH',
    name: 'Forgeron',
    tagline: 'Forge et améliore armes & armures.',
    unlockHeroLevel: 7,
    unlockCost: { GOLD: 300, IRON: 80, WOOD: 60 },
    tracks: [
      track('IRON_GEAR',   'IRON',   1, 180, 1),
      track('COPPER_GEAR', 'COPPER', 3, 300, 1),
      track('SILVER_GEAR', 'SILVER', 5, 480, 1),
    ],
    baseInputs: { IRON: 6, LEATHER: 3 },
  },
};

// ---------------------------------------------------------------------------
// Skill point model — each companion level = +1 skill point
// ---------------------------------------------------------------------------

export const QUANTITY_PICK = 0.2;            // +20 % per pick (additive)
export const SPEED_PICK = 0.1;               // -10 % base time per pick (additive)
export const SPEED_FLOOR_MULTIPLIER = 0.2;   // hard cap: 5× speed max
export const QUANTITY_CEIL_MULTIPLIER = 5;   // hard cap: 5× qty max

export interface CompanionSkillSpend {
  trackCode: string;
  axis: SkillAxis;
}

export function effectiveCycleSeconds(
  trk: ResourceTrack,
  spends: CompanionSkillSpend[],
): number {
  const picks = spends.filter((s) => s.trackCode === trk.code && s.axis === 'SPEED').length;
  const raw = trk.baseCycleSeconds * Math.max(SPEED_FLOOR_MULTIPLIER, 1 - SPEED_PICK * picks);
  return Math.max(5, Math.round(raw));
}

export function effectiveQuantity(
  trk: ResourceTrack,
  spends: CompanionSkillSpend[],
): number {
  const picks = spends.filter((s) => s.trackCode === trk.code && s.axis === 'QUANTITY').length;
  const mult = Math.min(QUANTITY_CEIL_MULTIPLIER, 1 + QUANTITY_PICK * picks);
  return Math.max(1, Math.round(trk.baseOutput * mult));
}

export function unlockedTracks(
  spec: CompanionSpec,
  companionLevel: number,
): ResourceTrack[] {
  return spec.tracks.filter((t) => t.unlockAtLevel <= companionLevel);
}

/**
 * Cumulative cycles → companion level.
 * 1→0  2→5  3→12  4→22  5→35  6→55  7→80  8→110, then +30 per level.
 */
const LEVEL_THRESHOLDS = [0, 5, 12, 22, 35, 55, 80, 110];
export function levelForCycles(cycles: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (cycles >= (LEVEL_THRESHOLDS[i] ?? Infinity)) level = i + 1;
  }
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!;
  if (cycles > last) {
    level = LEVEL_THRESHOLDS.length + Math.floor((cycles - last) / 30);
  }
  return level;
}

// ---------------------------------------------------------------------------
// Runtime DTOs
// ---------------------------------------------------------------------------

export interface Companion {
  id: string;
  heroId: string;
  role: CompanionRole;
  state: CompanionState;
  level: number;
  cyclesCompleted: number;
  toolDurability: number;
  activeTrack: string;
  skillPointsUnspent: number;
  cycleStartAt: string | null;
  cycleFinishAt: string | null;
  unlockedAt: string | null;
  spends: CompanionSkillSpend[];
  unlockedTrackCodes: string[];
}

export const OFFLINE_CYCLE_CAP = 12;
