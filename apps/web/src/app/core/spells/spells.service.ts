import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { HeroSpell, SpellDef } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class SpellsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/spells`;

  readonly catalog = signal<SpellDef[]>([]);
  readonly mine = signal<HeroSpell[]>([]);

  async loadCatalog(): Promise<SpellDef[]> {
    const r = await firstValueFrom(this.http.get<SpellDef[]>(`${this.base}/catalog`));
    this.catalog.set(r);
    return r;
  }

  async loadMine(): Promise<HeroSpell[]> {
    const r = await firstValueFrom(this.http.get<HeroSpell[]>(`${this.base}/me`));
    this.mine.set(r);
    return r;
  }

  async equip(code: string): Promise<HeroSpell[]> {
    const r = await firstValueFrom(
      this.http.post<HeroSpell[]>(`${this.base}/${code}/equip`, {}),
    );
    this.mine.set(r);
    return r;
  }

  async unequip(code: string): Promise<HeroSpell[]> {
    const r = await firstValueFrom(
      this.http.post<HeroSpell[]>(`${this.base}/${code}/unequip`, {}),
    );
    this.mine.set(r);
    return r;
  }
}
