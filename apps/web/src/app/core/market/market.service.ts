import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CreateResourceListingRequest,
  MarketListing,
  MarketListingType,
  ResourceType,
} from '@swordgame/shared';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.apiBaseUrl}/api/market`;

  readonly listings = signal<MarketListing[]>([]);
  readonly mine = signal<MarketListing[]>([]);

  async loadListings(filter?: {
    resourceType?: ResourceType;
    listingType?: MarketListingType;
  }): Promise<MarketListing[]> {
    const params = new URLSearchParams();
    if (filter?.resourceType) params.set('resourceType', filter.resourceType);
    if (filter?.listingType) params.set('listingType', filter.listingType);
    const qs = params.toString();
    const url = qs ? `${this.base}/listings?${qs}` : `${this.base}/listings`;
    const r = await firstValueFrom(this.http.get<MarketListing[]>(url));
    this.listings.set(r);
    return r;
  }

  async loadMine(): Promise<MarketListing[]> {
    const r = await firstValueFrom(this.http.get<MarketListing[]>(`${this.base}/mine`));
    this.mine.set(r);
    return r;
  }

  async createResourceListing(req: CreateResourceListingRequest): Promise<MarketListing> {
    return firstValueFrom(
      this.http.post<MarketListing>(`${this.base}/listings/resource`, req),
    );
  }

  async buy(id: string): Promise<MarketListing> {
    return firstValueFrom(this.http.post<MarketListing>(`${this.base}/listings/${id}/buy`, {}));
  }

  async bid(id: string, amount: number): Promise<MarketListing> {
    return firstValueFrom(
      this.http.post<MarketListing>(`${this.base}/listings/${id}/bid`, { amount }),
    );
  }

  async cancel(id: string): Promise<MarketListing> {
    return firstValueFrom(this.http.delete<MarketListing>(`${this.base}/listings/${id}`));
  }
}
