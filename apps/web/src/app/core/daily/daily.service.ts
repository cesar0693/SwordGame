import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ClaimDailyResponse, DailyClaimState } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class DailyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/daily`;

  readonly state = signal<DailyClaimState | null>(null);

  async loadState(): Promise<DailyClaimState> {
    const s = await firstValueFrom(this.http.get<DailyClaimState>(`${this.base}/state`));
    this.state.set(s);
    return s;
  }

  async claim(): Promise<ClaimDailyResponse> {
    return firstValueFrom(this.http.post<ClaimDailyResponse>(`${this.base}/claim`, {}));
  }
}
