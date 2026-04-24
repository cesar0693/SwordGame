import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ChallengeCooldownState,
  LeaderboardEntry,
  PvpMatchSummary,
} from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class PvpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/pvp`;

  readonly leaderboard = signal<LeaderboardEntry[]>([]);
  readonly matches = signal<PvpMatchSummary[]>([]);
  readonly cooldown = signal<ChallengeCooldownState | null>(null);

  async loadLeaderboard(): Promise<LeaderboardEntry[]> {
    const r = await firstValueFrom(
      this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`),
    );
    this.leaderboard.set(r);
    return r;
  }

  async loadCooldown(): Promise<ChallengeCooldownState> {
    const r = await firstValueFrom(
      this.http.get<ChallengeCooldownState>(`${this.base}/cooldown`),
    );
    this.cooldown.set(r);
    return r;
  }

  async loadMatches(): Promise<PvpMatchSummary[]> {
    const r = await firstValueFrom(
      this.http.get<PvpMatchSummary[]>(`${this.base}/matches`),
    );
    this.matches.set(r);
    return r;
  }

  async challenge(
    defenderHeroId: string,
    consumableItemIds: string[],
  ): Promise<PvpMatchSummary> {
    return firstValueFrom(
      this.http.post<PvpMatchSummary>(`${this.base}/challenge`, {
        defenderHeroId,
        consumableItemIds,
      }),
    );
  }
}
