import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AUCTION_DURATIONS_HOURS,
  netSellerGold,
  type AuctionDurationHours,
  type ItemRarity,
  type ItemSlot,
  type ItemStatBonus,
  type MarketAssetType,
  type MarketItemSnapshot,
  type MarketListing,
  type MarketListingState,
  type MarketListingType,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';

type Tx = Prisma.TransactionClient;

const LISTING_INCLUDE = {
  sellerHero: { select: { name: true } },
  item: {
    select: {
      id: true,
      name: true,
      slot: true,
      rarity: true,
      bonuses: true,
      upgradeLevel: true,
    },
  },
} as const;

type ListingWithIncludes = Prisma.MarketListingGetPayload<{
  include: typeof LISTING_INCLUDE;
}>;

interface CreateResourceListingInput {
  listingType: MarketListingType;
  resourceType: ResourceType;
  amount: number;
  priceGold: number;
  buyoutGold?: number | null;
  durationHours?: AuctionDurationHours;
}

interface CreateItemListingInput {
  listingType: MarketListingType;
  itemId: string;
  priceGold: number;
  buyoutGold?: number | null;
  durationHours?: AuctionDurationHours;
}

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
  ) {}

  // -----------------------------------------------------------------------
  // Browse
  // -----------------------------------------------------------------------

  async listActive(filter?: {
    assetType?: MarketAssetType;
    resourceType?: ResourceType;
    listingType?: MarketListingType;
  }): Promise<MarketListing[]> {
    await this.expireStale();
    const rows = await this.prisma.marketListing.findMany({
      where: {
        state: 'ACTIVE',
        ...(filter?.assetType ? { assetType: filter.assetType } : {}),
        ...(filter?.resourceType ? { resourceType: filter.resourceType } : {}),
        ...(filter?.listingType ? { listingType: filter.listingType } : {}),
      },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  async listMine(heroId: string): Promise<MarketListing[]> {
    const rows = await this.prisma.marketListing.findMany({
      where: { sellerHeroId: heroId },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  // -----------------------------------------------------------------------
  // Create a resource listing
  // -----------------------------------------------------------------------

  async createResourceListing(
    heroId: string,
    input: CreateResourceListingInput,
  ): Promise<MarketListing> {
    this.validateCommon(input);
    if (input.amount <= 0) throw new BadRequestException('amount must be > 0');
    if (input.resourceType === 'GOLD') {
      throw new BadRequestException('Cannot list gold on the market');
    }

    const expiresAt = this.expiresAtFor(input);

    return this.prisma.$transaction(async (tx) => {
      await this.resources.add(heroId, input.resourceType, -input.amount, tx);

      const row = await tx.marketListing.create({
        data: {
          sellerHeroId: heroId,
          listingType: input.listingType,
          assetType: 'RESOURCE',
          resourceType: input.resourceType,
          amount: input.amount,
          priceGold: input.priceGold,
          buyoutGold: input.buyoutGold ?? null,
          expiresAt,
        },
        include: LISTING_INCLUDE,
      });
      return this.toDto(row);
    });
  }

  // -----------------------------------------------------------------------
  // Create an item listing
  // -----------------------------------------------------------------------

  async createItemListing(
    heroId: string,
    input: CreateItemListingInput,
  ): Promise<MarketListing> {
    this.validateCommon(input);

    const expiresAt = this.expiresAtFor(input);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: input.itemId } });
      if (!item || item.heroId !== heroId) {
        throw new NotFoundException('Item not found');
      }
      if (item.kind !== 'EQUIPMENT') {
        throw new BadRequestException('Only equipment can be listed for now');
      }
      if (item.equipped) {
        throw new ConflictException('Unequip the item before listing it');
      }
      if (item.onMarket) {
        throw new ConflictException('Item is already listed');
      }

      // Mark as onMarket (escrow). Keep ownership on the seller until sale.
      await tx.item.update({
        where: { id: item.id },
        data: { onMarket: true },
      });

      const row = await tx.marketListing.create({
        data: {
          sellerHeroId: heroId,
          listingType: input.listingType,
          assetType: 'ITEM',
          itemId: item.id,
          priceGold: input.priceGold,
          buyoutGold: input.buyoutGold ?? null,
          expiresAt,
        },
        include: LISTING_INCLUDE,
      });
      return this.toDto(row);
    });
  }

  // -----------------------------------------------------------------------
  // Instant buy
  // -----------------------------------------------------------------------

  async buy(heroId: string, listingId: string): Promise<MarketListing> {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: LISTING_INCLUDE,
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.state !== 'ACTIVE') throw new ConflictException('Listing not active');
      if (listing.sellerHeroId === heroId)
        throw new ForbiddenException('Cannot buy your own listing');

      if (listing.listingType === 'INSTANT_BUY') {
        return this.settleBuy(tx, listing, heroId, listing.priceGold);
      }
      if (!listing.buyoutGold) {
        throw new BadRequestException('This auction has no buyout');
      }
      return this.settleBuy(tx, listing, heroId, listing.buyoutGold);
    });
  }

  // -----------------------------------------------------------------------
  // Place a bid (AUCTION)
  // -----------------------------------------------------------------------

  async placeBid(
    heroId: string,
    listingId: string,
    amount: number,
  ): Promise<MarketListing> {
    if (amount <= 0) throw new BadRequestException('bid must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: LISTING_INCLUDE,
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.state !== 'ACTIVE') throw new ConflictException('Listing not active');
      if (listing.listingType !== 'AUCTION')
        throw new BadRequestException('Not an auction');
      if (listing.sellerHeroId === heroId)
        throw new ForbiddenException('Cannot bid on your own auction');
      if (listing.expiresAt.getTime() <= Date.now())
        throw new ConflictException('Auction already expired');

      const floor = listing.highestBid ?? listing.priceGold - 1;
      if (amount <= floor) {
        throw new BadRequestException(
          `Bid must be > ${floor} (current high ${listing.highestBid ?? 'none'})`,
        );
      }

      await this.resources.add(heroId, 'GOLD', -amount, tx);
      if (listing.highestBidderId && listing.highestBid) {
        await this.resources.add(listing.highestBidderId, 'GOLD', listing.highestBid, tx);
      }

      await tx.marketBid.create({
        data: { listingId, bidderHeroId: heroId, amount },
      });

      if (listing.buyoutGold && amount >= listing.buyoutGold) {
        return this.settleAuction(tx, listing.id, heroId, amount);
      }

      const updated = await tx.marketListing.update({
        where: { id: listing.id },
        data: { highestBid: amount, highestBidderId: heroId },
        include: LISTING_INCLUDE,
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Cancel own listing (auction: only if no bids yet)
  // -----------------------------------------------------------------------

  async cancel(heroId: string, listingId: string): Promise<MarketListing> {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: LISTING_INCLUDE,
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerHeroId !== heroId) throw new ForbiddenException();
      if (listing.state !== 'ACTIVE') throw new ConflictException('Not active');
      if (listing.listingType === 'AUCTION' && listing.highestBid) {
        throw new ConflictException('Cannot cancel an auction with bids');
      }

      await this.refundSellerEscrow(tx, listing);

      const updated = await tx.marketListing.update({
        where: { id: listing.id },
        data: { state: 'CANCELLED' },
        include: LISTING_INCLUDE,
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Expire stale listings + settle any winning auctions.
  // -----------------------------------------------------------------------

  async expireStale(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.marketListing.findMany({
      where: { state: 'ACTIVE', expiresAt: { lte: now } },
      select: {
        id: true,
        listingType: true,
        highestBid: true,
        highestBidderId: true,
      },
    });
    for (const listing of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (
            listing.listingType === 'AUCTION' &&
            listing.highestBidderId &&
            listing.highestBid
          ) {
            await this.settleAuction(
              tx,
              listing.id,
              listing.highestBidderId,
              listing.highestBid,
            );
            return;
          }
          const full = await tx.marketListing.findUnique({
            where: { id: listing.id },
            include: LISTING_INCLUDE,
          });
          if (full) await this.refundSellerEscrow(tx, full);
          await tx.marketListing.update({
            where: { id: listing.id },
            data: { state: 'EXPIRED' },
          });
        });
      } catch {
        // swallow — one failed row doesn't block the read
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private: settlement + escrow helpers
  // -----------------------------------------------------------------------

  private async settleBuy(
    tx: Tx,
    listing: ListingWithIncludes,
    buyerId: string,
    price: number,
  ): Promise<MarketListing> {
    await this.resources.add(buyerId, 'GOLD', -price, tx);
    await this.transferAssetToBuyer(tx, listing, buyerId);
    await this.resources.add(listing.sellerHeroId, 'GOLD', netSellerGold(price), tx);

    const updated = await tx.marketListing.update({
      where: { id: listing.id },
      data: { state: 'SOLD', buyerHeroId: buyerId, soldAt: new Date() },
      include: LISTING_INCLUDE,
    });
    return this.toDto(updated);
  }

  private async settleAuction(
    tx: Tx,
    listingId: string,
    winnerId: string,
    price: number,
  ): Promise<MarketListing> {
    const listing = await tx.marketListing.findUnique({
      where: { id: listingId },
      include: LISTING_INCLUDE,
    });
    if (!listing) throw new NotFoundException();

    await this.transferAssetToBuyer(tx, listing, winnerId);
    await this.resources.add(listing.sellerHeroId, 'GOLD', netSellerGold(price), tx);

    const updated = await tx.marketListing.update({
      where: { id: listing.id },
      data: { state: 'SOLD', buyerHeroId: winnerId, soldAt: new Date() },
      include: LISTING_INCLUDE,
    });
    return this.toDto(updated);
  }

  private async transferAssetToBuyer(
    tx: Tx,
    listing: ListingWithIncludes,
    buyerId: string,
  ): Promise<void> {
    if (listing.assetType === 'RESOURCE' && listing.resourceType && listing.amount) {
      await this.resources.add(
        buyerId,
        listing.resourceType as ResourceType,
        listing.amount,
        tx,
      );
      return;
    }
    if (listing.assetType === 'ITEM' && listing.itemId) {
      await tx.item.update({
        where: { id: listing.itemId },
        data: { heroId: buyerId, onMarket: false, equipped: false },
      });
    }
  }

  private async refundSellerEscrow(
    tx: Tx,
    listing: ListingWithIncludes,
  ): Promise<void> {
    if (listing.assetType === 'RESOURCE' && listing.resourceType && listing.amount) {
      await this.resources.add(
        listing.sellerHeroId,
        listing.resourceType as ResourceType,
        listing.amount,
        tx,
      );
      return;
    }
    if (listing.assetType === 'ITEM' && listing.itemId) {
      await tx.item.update({
        where: { id: listing.itemId },
        data: { onMarket: false },
      });
    }
  }

  private validateCommon(input: {
    listingType: MarketListingType;
    priceGold: number;
    buyoutGold?: number | null;
    durationHours?: AuctionDurationHours;
  }): void {
    if (input.priceGold <= 0) throw new BadRequestException('price must be > 0');
    if (input.listingType === 'AUCTION') {
      if (!input.durationHours || !AUCTION_DURATIONS_HOURS.includes(input.durationHours)) {
        throw new BadRequestException('Invalid auction duration');
      }
      if (input.buyoutGold && input.buyoutGold < input.priceGold) {
        throw new BadRequestException('Buyout must be >= start price');
      }
    }
  }

  private expiresAtFor(input: {
    listingType: MarketListingType;
    durationHours?: AuctionDurationHours;
  }): Date {
    const hours = input.listingType === 'AUCTION' ? input.durationHours! : 24 * 3;
    return new Date(Date.now() + hours * 3600 * 1000);
  }

  private toDto(row: ListingWithIncludes): MarketListing {
    const snap: MarketItemSnapshot | null = row.item
      ? {
          name: row.item.name,
          slot: (row.item.slot as ItemSlot | null) ?? null,
          rarity: row.item.rarity as ItemRarity,
          bonuses: (row.item.bonuses ?? {}) as ItemStatBonus,
          upgradeLevel: row.item.upgradeLevel,
        }
      : null;
    return {
      id: row.id,
      sellerHeroId: row.sellerHeroId,
      sellerName: row.sellerHero?.name ?? '',
      listingType: row.listingType as MarketListingType,
      assetType: row.assetType as MarketAssetType,
      resourceType: (row.resourceType as ResourceType | null) ?? null,
      amount: row.amount,
      itemId: row.itemId,
      item: snap,
      priceGold: row.priceGold,
      buyoutGold: row.buyoutGold,
      highestBid: row.highestBid,
      highestBidderId: row.highestBidderId,
      state: row.state as MarketListingState,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
