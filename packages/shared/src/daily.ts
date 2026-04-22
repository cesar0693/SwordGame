export interface DailyClaimState {
  /** Last claimed day, ISO string, or null if never claimed. */
  lastClaimDay: string | null;
  /** Current streak (consecutive days including last claim). */
  streak: number;
  /** True if the claim for "today" is still available. */
  canClaimToday: boolean;
  /** Preview of today's reward if claimed now. */
  previewGold: number;
}

export interface ClaimDailyResponse {
  rewardGold: number;
  newStreak: number;
}

/** Scaling daily reward: base 20g + 10g per streak day, capped at 7 days. */
export function dailyGoldFor(streak: number): number {
  const capped = Math.min(streak, 7);
  return 20 + 10 * (capped - 1);
}
