import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { DailyQuestState } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class QuestsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/quests`;

  readonly today = signal<DailyQuestState[]>([]);

  async loadToday(): Promise<DailyQuestState[]> {
    const r = await firstValueFrom(
      this.http.get<DailyQuestState[]>(`${this.base}/today`),
    );
    this.today.set(r);
    return r;
  }

  async claim(code: string): Promise<DailyQuestState> {
    const r = await firstValueFrom(
      this.http.post<DailyQuestState>(`${this.base}/${code}/claim`, {}),
    );
    this.today.update((list) => list.map((q) => (q.code === code ? r : q)));
    return r;
  }
}
