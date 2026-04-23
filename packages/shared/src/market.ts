import type { ResourceType } from './resources.js';
import type { ItemRarity, ItemSlot, ItemStatBonus } from './items.js';

export type MarketListingType = 'INSTANT_BUY' | 'AUCTION';
export type MarketListingState = 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'EXPIRED';
export type MarketAssetType = 'RESOURCE' | 'ITEM';

export const MARKET_TAX_RATE = 0.05;

/** Allowed auction durations in hours. */
export const AUCTION_DURATIONS_HOURS = [1, 8, 24] as const;
export type AuctionDurationHours = (typeof AUCTION_DURATIONS_HOURS)[number];

/**
 * Compact snapshot of an item embedded in a market listing,
 * so buyers can preview stats without a second round-trip.
 */
export interface MarketItemSnapshot {
  name: string;
  slot: ItemSlot | null;
  rarity: ItemRarity;
  bonuses: ItemStatBonus;
  upgradeLevel: number;
}

export interface MarketListing {
  id: string;
  sellerHeroId: string;
  sellerName: string;
  listingType: MarketListingType;
  assetType: MarketAssetType;
  resourceType: ResourceType | null;
  amount: number | null;
  itemId: string | null;
  item: MarketItemSnapshot | null;
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

export interface CreateItemListingRequest {
  listingType: MarketListingType;
  itemId: string;
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
