import type { CombatReport } from './combat.js';
import type { HeroClass } from './hero.js';

export const PVP_K_FACTOR = 32;
export const PVP_STARTING_RATING = 1000;
export const PVP_MIN_RATING = 100;
export const PVP_CHALLENGE_COOLDOWN_SECONDS = 5 * 60;

/** Elo expected score of A against B. */
export function eloExpected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Returns `{ newA, newB }` after A plays B, with `scoreA` in {0, 1}. */
export function applyElo(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 1,
  k: number = PVP_K_FACTOR,
): { newA: number; newB: number } {
  const eA = eloExpected(ratingA, ratingB);
  const newA = Math.max(PVP_MIN_RATING, Math.round(ratingA + k * (scoreA - eA)));
  const newB = Math.max(PVP_MIN_RATING, Math.round(ratingB + k * ((1 - scoreA) - (1 - eA))));
  return { newA, newB };
}

/**
 * Reward in gold for the winning attacker. Upsets pay more, farming pays less.
 */
export function pvpWinnerGold(
  winnerRating: number,
  loserRating: number,
): number {
  const delta = Math.round((loserRating - winnerRating) / 20);
  return Math.max(10, 20 + delta);
}

/** Consolation gold for the loser. */
export const PVP_LOSER_GOLD = 5;

export interface LeaderboardEntry {
  heroId: string;
  name: string;
  heroClass: HeroClass;
  level: number;
  pvpRating: number;
  rank: number;
}

export interface PvpMatchSummary {
  id: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN';
  attackerRatingBefore: number;
  attackerRatingAfter: number;
  defenderRatingBefore: number;
  defenderRatingAfter: number;
  winnerGold: number;
  loserGold: number;
  playedAt: string;
  report: CombatReport;
}

export interface ChallengeCooldownState {
  ready: boolean;
  secondsRemaining: number;
  nextReadyAt: string | null;
}
