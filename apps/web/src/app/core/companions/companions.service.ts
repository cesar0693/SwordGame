import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Companion, CompanionRole, SkillAxis } from '@swordgame/shared';
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
    return this.patched(
      await firstValueFrom(this.http.post<Companion>(`${this.base}/${role}/unlock`, {})),
    );
  }

  async start(role: CompanionRole): Promise<Companion> {
    return this.patched(
      await firstValueFrom(this.http.post<Companion>(`${this.base}/${role}/start`, {})),
    );
  }

  async claim(role: CompanionRole): Promise<Companion> {
    return this.patched(
      await firstValueFrom(this.http.post<Companion>(`${this.base}/${role}/claim`, {})),
    );
  }

  async setTrack(role: CompanionRole, trackCode: string): Promise<Companion> {
    return this.patched(
      await firstValueFrom(
        this.http.post<Companion>(`${this.base}/${role}/track`, { trackCode }),
      ),
    );
  }

  async spendSkill(
    role: CompanionRole,
    trackCode: string,
    axis: SkillAxis,
  ): Promise<Companion> {
    return this.patched(
      await firstValueFrom(
        this.http.post<Companion>(`${this.base}/${role}/skill`, { trackCode, axis }),
      ),
    );
  }

  private patched(c: Companion): Companion {
    this.companions.update((list) => list.map((x) => (x.id === c.id ? c : x)));
    return c;
  }
}
