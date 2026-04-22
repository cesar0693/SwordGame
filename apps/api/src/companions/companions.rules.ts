import {
  COMPANION_CATALOG,
  effectiveCycleSeconds,
  effectiveQuantity,
  levelForCycles,
  unlockedTracks,
  type CompanionRole,
  type CompanionSkillSpend,
  type ResourceTrack,
  type SkillAxis,
} from '@swordgame/shared';

export {
  levelForCycles,
  unlockedTracks,
  effectiveCycleSeconds,
  effectiveQuantity,
};

export function trackByCode(
  role: CompanionRole,
  trackCode: string,
): ResourceTrack | null {
  return COMPANION_CATALOG[role].tracks.find((t) => t.code === trackCode) ?? null;
}

/** Default (starter) track for a role: always the first in the catalog. */
export function defaultTrackCode(role: CompanionRole): string {
  return COMPANION_CATALOG[role].tracks[0]!.code;
}

/** True if the track is unlocked at a given companion level. */
export function trackUnlocked(
  role: CompanionRole,
  trackCode: string,
  companionLevel: number,
): boolean {
  const t = trackByCode(role, trackCode);
  if (!t) return false;
  return t.unlockAtLevel <= companionLevel;
}

export interface CompanionRuntime {
  effectiveSeconds: number;
  effectiveAmount: number;
}

export function runtimeFor(
  role: CompanionRole,
  trackCode: string,
  spends: CompanionSkillSpend[],
): CompanionRuntime | null {
  const t = trackByCode(role, trackCode);
  if (!t) return null;
  return {
    effectiveSeconds: effectiveCycleSeconds(t, spends),
    effectiveAmount: effectiveQuantity(t, spends),
  };
}

export const VALID_AXES: SkillAxis[] = ['QUANTITY', 'SPEED'];
