import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Item } from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/items`;

  readonly items = signal<Item[]>([]);

  async loadMine(): Promise<Item[]> {
    const r = await firstValueFrom(this.http.get<Item[]>(`${this.base}/me`));
    this.items.set(r);
    return r;
  }

  async equip(id: string): Promise<Item> {
    const r = await firstValueFrom(this.http.post<Item>(`${this.base}/${id}/equip`, {}));
    await this.loadMine();
    return r;
  }

  async unequip(id: string): Promise<Item> {
    const r = await firstValueFrom(this.http.post<Item>(`${this.base}/${id}/unequip`, {}));
    await this.loadMine();
    return r;
  }

  async drop(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
    await this.loadMine();
  }
}
