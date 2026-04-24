import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  MinigameCode,
  MinigamePlayResult,
  MinigameState,
} from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class MinigamesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/minigames`;

  readonly state = signal<MinigameState[]>([]);

  async loadState(): Promise<MinigameState[]> {
    const r = await firstValueFrom(
      this.http.get<MinigameState[]>(`${this.base}/state`),
    );
    this.state.set(r);
    return r;
  }

  async play(
    code: MinigameCode,
    betGold: number,
    choice?: 'HEADS' | 'TAILS',
  ): Promise<MinigamePlayResult> {
    return firstValueFrom(
      this.http.post<MinigamePlayResult>(`${this.base}/play`, {
        code,
        betGold,
        choice,
      }),
    );
  }
}
