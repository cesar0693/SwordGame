import type { ResourceType } from './resources.js';

export const BUILDING_TYPES = [
  'WOODCUTTER',
  'MINE',
  'TANNERY',
  'HERBALIST',
  'FORGE',
  'ALTAR',
  'TENT',
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export interface Building {
  id: string;
  heroId: string;
  type: BuildingType;
  level: number;
  upgradeStartedAt: string | null;
  upgradeFinishesAt: string | null;
}

export const PRODUCER_BUILDING_RESOURCE: Partial<Record<BuildingType, ResourceType>> = {
  WOODCUTTER: 'WOOD',
  MINE: 'IRON',
  TANNERY: 'LEATHER',
  HERBALIST: 'HERB',
};

/** Hourly production at a given building level (simple exponential curve). */
export function productionPerHour(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(10 * Math.pow(1.25, level - 1));
}

/** Duration (seconds) to upgrade to the given level. */
export function upgradeDurationSeconds(targetLevel: number): number {
  return Math.floor(30 * Math.pow(1.35, targetLevel - 1));
}
