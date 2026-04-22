import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Companion, CompanionRole } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class CompanionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/companions`;

  readonly companions = signal<Companion[]>([]);

  async loadMine(): Promise<Companion[]> {
    const r = await firstValueFrom(this.http.get<Companion[]>(`${this.base}/me`));
    this.companions.set(r);
    return r;
  }

  async unlock(role: CompanionRole): Promise<Companion> {
    const c = await firstValueFrom(
      this.http.post<Companion>(`${this.base}/${role}/unlock`, {}),
    );
    this.patch(c);
    return c;
  }

  async start(role: CompanionRole): Promise<Companion> {
    const c = await firstValueFrom(
      this.http.post<Companion>(`${this.base}/${role}/start`, {}),
    );
    this.patch(c);
    return c;
  }

  async claim(role: CompanionRole): Promise<Companion> {
    const c = await firstValueFrom(
      this.http.post<Companion>(`${this.base}/${role}/claim`, {}),
    );
    this.patch(c);
    return c;
  }

  async pickPerk(role: CompanionRole, level: number, code: string): Promise<Companion> {
    const c = await firstValueFrom(
      this.http.post<Companion>(`${this.base}/${role}/perk`, { level, code }),
    );
    this.patch(c);
    return c;
  }

  private patch(c: Companion): void {
    this.companions.update((list) => list.map((x) => (x.id === c.id ? c : x)));
  }
}
