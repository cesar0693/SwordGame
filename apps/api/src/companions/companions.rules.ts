import type { CompanionRole } from '@swordgame/shared';
import { COMPANION_CATALOG } from '@swordgame/shared';

/**
 * Cumulative cycles needed to reach a given level.
 * Level 1 → 0 cycles (starting state)
 * Level 2 → 5 cycles
 * Level 3 → 12 cycles
 * Level 4 → 22 cycles
 * Level 5 → 35 cycles
 * Level 6 → 55 cycles
 */
const LEVEL_THRESHOLDS = [0, 5, 12, 22, 35, 55];

export function levelForCycles(cycles: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (cycles >= (LEVEL_THRESHOLDS[i] ?? Infinity)) {
      level = i + 1;
    }
  }
  return level;
}

/** Returns a perk-choice level awaiting a decision, or null. */
export function pendingPerkLevel(
  role: CompanionRole,
  currentLevel: number,
  pickedLevels: number[],
): number | null {
  const spec = COMPANION_CATALOG[role];
  for (const tier of spec.perkTiers) {
    if (tier.level <= currentLevel && !pickedLevels.includes(tier.level)) {
      return tier.level;
    }
  }
  return null;
}

interface CycleModifiers {
  speedMultiplier: number;
  quantityMultiplier: number;
  inputMultiplier: number;
  durabilityWear: number;
}

export function cycleModifiersFromPerks(perkCodes: string[]): CycleModifiers {
  const mod: CycleModifiers = {
    speedMultiplier: 1,
    quantityMultiplier: 1,
    inputMultiplier: 1,
    durabilityWear: 2, // 2 durability per cycle by default
  };

  for (const code of perkCodes) {
    switch (code) {
      case 'QUANTITY_25':
        mod.quantityMultiplier *= 1.25;
        break;
      case 'SPEED_20':
        mod.speedMultiplier *= 0.8;
        break;
      case 'SPEED_25':
        mod.speedMultiplier *= 0.75;
        break;
      case 'TOOL_DURABILITY':
        mod.durabilityWear *= 0.5;
        break;
      case 'COST_REDUCTION':
        mod.inputMultiplier *= 0.8;
        break;
      case 'OVERTIME':
        mod.quantityMultiplier *= 1.4;
        mod.durabilityWear *= 1.15;
        break;
      case 'POTENCY_25':
        mod.quantityMultiplier *= 1.25;
        break;
      // NEW_RESOURCE, BATCH_YIELD, CRIT_RARE, AUTO_RESTART, STORAGE_BOOST,
      // RECIPE_UNLOCK, DURATION_50, DOUBLE_CRAFT, AUTO_QUEUE, RARE_PROC,
      // SIGNATURE → effects handled in later phases or on drop rolls.
      default:
        break;
    }
  }
  return mod;
}
