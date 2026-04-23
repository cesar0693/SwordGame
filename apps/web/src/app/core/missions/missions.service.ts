import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CombatReport, Item, MissionDef } from '@swordgame/shared';
import { env } from '../env';

export interface ActiveMissionRun {
  runId: string;
  missionCode: string;
  startAt: string;
  finishAt: string;
  status: string;
  consumableItemIds: string[];
}

@Injectable({ providedIn: 'root' })
export class MissionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/missions`;

  readonly catalog = signal<MissionDef[]>([]);
  readonly active = signal<ActiveMissionRun | null>(null);
  readonly consumables = signal<Item[]>([]);

  async loadCatalog(): Promise<MissionDef[]> {
    const r = await firstValueFrom(this.http.get<MissionDef[]>(`${this.base}/catalog`));
    this.catalog.set(r);
    return r;
  }

  async loadActive(): Promise<ActiveMissionRun | null> {
    const r = await firstValueFrom(
      this.http.get<ActiveMissionRun | null>(`${this.base}/active`),
    );
    this.active.set(r ?? null);
    return r;
  }

  async loadConsumables(): Promise<Item[]> {
    const r = await firstValueFrom(this.http.get<Item[]>(`${this.base}/consumables`));
    this.consumables.set(r);
    return r;
  }

  async start(
    missionCode: string,
    consumableItemIds: string[],
  ): Promise<{ runId: string; startAt: string; finishAt: string }> {
    return firstValueFrom(
      this.http.post<{ runId: string; startAt: string; finishAt: string }>(
        `${this.base}/start`,
        { missionCode, consumableItemIds },
      ),
    );
  }

  async claim(runId: string): Promise<CombatReport> {
    return firstValueFrom(
      this.http.post<CombatReport>(`${this.base}/${runId}/claim`, {}),
    );
  }
}
