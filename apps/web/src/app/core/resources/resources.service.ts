import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ResourceType } from '@swordgame/shared';
import { env } from '../env';

export interface ResourceEntry {
  type: ResourceType;
  amount: number;
}

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private readonly http = inject(HttpClient);

  readonly resources = signal<ResourceEntry[]>([]);

  async loadMine(): Promise<ResourceEntry[]> {
    const r = await firstValueFrom(
      this.http.get<ResourceEntry[]>(`${env.apiBaseUrl}/api/resources/me`),
    );
    this.resources.set(r);
    return r;
  }

  get(type: ResourceType): number {
    return this.resources().find((r) => r.type === type)?.amount ?? 0;
  }
}
