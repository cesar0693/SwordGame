import type { ResourceType } from './resources.js';

export type MarketListingType = 'INSTANT_BUY' | 'AUCTION';
export type MarketListingState = 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'EXPIRED';
export type MarketAssetType = 'RESOURCE' | 'ITEM';

export const MARKET_TAX_RATE = 0.05;

/** Allowed auction durations in hours. */
export const AUCTION_DURATIONS_HOURS = [1, 8, 24] as const;
export type AuctionDurationHours = (typeof AUCTION_DURATIONS_HOURS)[number];

export interface MarketListing {
  id: string;
  sellerHeroId: string;
  sellerName: string;
  listingType: MarketListingType;
  assetType: MarketAssetType;
  resourceType: ResourceType | null;
  amount: number | null;
  itemId: string | null;
  priceGold: number;          // instant-buy price OR minimum/start bid
  buyoutGold: number | null;  // auction buyout (optional)
  highestBid: number | null;
  highestBidderId: string | null;
  state: MarketListingState;
  expiresAt: string;
  createdAt: string;
}

export interface CreateResourceListingRequest {
  listingType: MarketListingType;
  resourceType: ResourceType;
  amount: number;
  priceGold: number;
  buyoutGold?: number;
  durationHours?: AuctionDurationHours; // required for AUCTION
}

export interface PlaceBidRequest {
  amount: number;
}

/** Net gold the seller receives after the house tax. */
export function netSellerGold(grossGold: number): number {
  return Math.floor(grossGold * (1 - MARKET_TAX_RATE));
}
