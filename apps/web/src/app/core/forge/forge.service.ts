import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Item, RecipeDef, ResourceType } from '@swordgame/shared';
import { env } from '../env';

export type RecipeRow = RecipeDef & { unlocked: boolean; affordable: boolean };

export interface UpgradeResult {
  success: boolean;
  newLevel: number;
  item: Item;
}

export interface SalvageResult {
  refund: Partial<Record<ResourceType, number>>;
}

@Injectable({ providedIn: 'root' })
export class ForgeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/forge`;

  readonly blacksmithLevel = signal(0);
  readonly recipes = signal<RecipeRow[]>([]);

  async loadState(): Promise<number> {
    const r = await firstValueFrom(
      this.http.get<{ blacksmithLevel: number }>(`${this.base}/state`),
    );
    this.blacksmithLevel.set(r.blacksmithLevel);
    return r.blacksmithLevel;
  }

  async loadRecipes(): Promise<RecipeRow[]> {
    const r = await firstValueFrom(this.http.get<RecipeRow[]>(`${this.base}/recipes`));
    this.recipes.set(r);
    return r;
  }

  async craft(code: string): Promise<Item> {
    return firstValueFrom(
      this.http.post<Item>(`${this.base}/recipes/craft`, { code }),
    );
  }

  async upgrade(itemId: string): Promise<UpgradeResult> {
    return firstValueFrom(
      this.http.post<UpgradeResult>(`${this.base}/items/${itemId}/upgrade`, {}),
    );
  }

  async salvage(itemId: string): Promise<SalvageResult> {
    return firstValueFrom(
      this.http.post<SalvageResult>(`${this.base}/items/${itemId}/salvage`, {}),
    );
  }
}
