import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AllocatableStat, CreateHeroRequest, Hero } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class HeroesService {
  private readonly http = inject(HttpClient);

  readonly hero = signal<Hero | null>(null);

  async loadMine(): Promise<Hero | null> {
    const h = await firstValueFrom(
      this.http.get<Hero | null>(`${env.apiBaseUrl}/api/heroes/me`),
    );
    this.hero.set(h ?? null);
    return h ?? null;
  }

  async create(payload: CreateHeroRequest): Promise<Hero> {
    const h = await firstValueFrom(
      this.http.post<Hero>(`${env.apiBaseUrl}/api/heroes`, payload),
    );
    this.hero.set(h);
    return h;
  }

  async allocate(stat: AllocatableStat): Promise<Hero> {
    const h = await firstValueFrom(
      this.http.post<Hero>(`${env.apiBaseUrl}/api/heroes/allocate/${stat}`, {}),
    );
    this.hero.set(h);
    return h;
  }
}
