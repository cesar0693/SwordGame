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
  type MarketAssetType,
  type MarketListing,
  type MarketListingState,
  type MarketListingType,
  type ResourceType,
} from '@swordgame/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';

type Tx = Prisma.TransactionClient;

interface CreateResourceListingInput {
  listingType: MarketListingType;
  resourceType: ResourceType;
  amount: number;
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
    resourceType?: ResourceType;
    listingType?: MarketListingType;
  }): Promise<MarketListing[]> {
    await this.expireStale();
    const rows = await this.prisma.marketListing.findMany({
      where: {
        state: 'ACTIVE',
        ...(filter?.resourceType ? { resourceType: filter.resourceType } : {}),
        ...(filter?.listingType ? { listingType: filter.listingType } : {}),
      },
      include: { sellerHero: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  async listMine(heroId: string): Promise<MarketListing[]> {
    const rows = await this.prisma.marketListing.findMany({
      where: { sellerHeroId: heroId },
      include: { sellerHero: { select: { name: true } } },
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
    if (input.amount <= 0) throw new BadRequestException('amount must be > 0');
    if (input.priceGold <= 0) throw new BadRequestException('price must be > 0');
    if (input.resourceType === 'GOLD') {
      throw new BadRequestException('Cannot list gold on the market');
    }
    if (input.listingType === 'AUCTION') {
      if (!input.durationHours || !AUCTION_DURATIONS_HOURS.includes(input.durationHours)) {
        throw new BadRequestException('Invalid auction duration');
      }
      if (input.buyoutGold && input.buyoutGold < input.priceGold) {
        throw new BadRequestException('Buyout must be >= start price');
      }
    }

    const durationHours =
      input.listingType === 'AUCTION' ? input.durationHours! : 24 * 3;
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // Escrow the resources
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
        include: { sellerHero: { select: { name: true } } },
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
        include: { sellerHero: { select: { name: true } } },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.state !== 'ACTIVE') throw new ConflictException('Listing not active');
      if (listing.sellerHeroId === heroId)
        throw new ForbiddenException('Cannot buy your own listing');

      if (listing.listingType === 'INSTANT_BUY') {
        return this.settleBuy(tx, listing, heroId, listing.priceGold);
      }

      // Auction: buyout path only (bidding uses placeBid/closeAuction)
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
        include: { sellerHero: { select: { name: true } } },
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

      // Escrow: debit the new bidder, refund the previous top bidder.
      await this.resources.add(heroId, 'GOLD', -amount, tx);
      if (listing.highestBidderId && listing.highestBid) {
        await this.resources.add(listing.highestBidderId, 'GOLD', listing.highestBid, tx);
      }

      await tx.marketBid.create({
        data: { listingId, bidderHeroId: heroId, amount },
      });

      // Instant buyout via bid >= buyoutGold → close immediately.
      if (listing.buyoutGold && amount >= listing.buyoutGold) {
        return this.settleAuction(tx, listing.id, heroId, amount);
      }

      const updated = await tx.marketListing.update({
        where: { id: listing.id },
        data: { highestBid: amount, highestBidderId: heroId },
        include: { sellerHero: { select: { name: true } } },
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
        include: { sellerHero: { select: { name: true } } },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerHeroId !== heroId) throw new ForbiddenException();
      if (listing.state !== 'ACTIVE') throw new ConflictException('Not active');
      if (listing.listingType === 'AUCTION' && listing.highestBid) {
        throw new ConflictException('Cannot cancel an auction with bids');
      }

      // Refund escrowed resources to seller.
      if (listing.assetType === 'RESOURCE' && listing.resourceType && listing.amount) {
        await this.resources.add(
          heroId,
          listing.resourceType as ResourceType,
          listing.amount,
          tx,
        );
      }

      const updated = await tx.marketListing.update({
        where: { id: listing.id },
        data: { state: 'CANCELLED' },
        include: { sellerHero: { select: { name: true } } },
      });
      return this.toDto(updated);
    });
  }

  // -----------------------------------------------------------------------
  // Expire stale listings + settle any winning auctions.
  // Idempotent; run on every read.
  // -----------------------------------------------------------------------

  async expireStale(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.marketListing.findMany({
      where: { state: 'ACTIVE', expiresAt: { lte: now } },
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
          } else {
            // Refund escrow to seller
            if (
              listing.assetType === 'RESOURCE' &&
              listing.resourceType &&
              listing.amount
            ) {
              await this.resources.add(
                listing.sellerHeroId,
                listing.resourceType as ResourceType,
                listing.amount,
                tx,
              );
            }
            await tx.marketListing.update({
              where: { id: listing.id },
              data: { state: 'EXPIRED' },
            });
          }
        });
      } catch {
        // swallow; a failed row won't block the read
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private: settlement helpers
  // -----------------------------------------------------------------------

  private async settleBuy(
    tx: Tx,
    listing: Awaited<ReturnType<PrismaService['marketListing']['findUnique']>>,
    buyerId: string,
    price: number,
  ): Promise<MarketListing> {
    if (!listing) throw new NotFoundException();
    // Debit buyer gold
    await this.resources.add(buyerId, 'GOLD', -price, tx);
    // Transfer asset to buyer
    if (listing.assetType === 'RESOURCE' && listing.resourceType && listing.amount) {
      await this.resources.add(
        buyerId,
        listing.resourceType as ResourceType,
        listing.amount,
        tx,
      );
    }
    // Credit seller minus tax
    await this.resources.add(listing.sellerHeroId, 'GOLD', netSellerGold(price), tx);

    const updated = await tx.marketListing.update({
      where: { id: listing.id },
      data: {
        state: 'SOLD',
        buyerHeroId: buyerId,
        soldAt: new Date(),
      },
      include: { sellerHero: { select: { name: true } } },
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
      include: { sellerHero: { select: { name: true } } },
    });
    if (!listing) throw new NotFoundException();

    // Gold was already escrowed by the bid. Transfer asset + credit seller.
    if (listing.assetType === 'RESOURCE' && listing.resourceType && listing.amount) {
      await this.resources.add(
        winnerId,
        listing.resourceType as ResourceType,
        listing.amount,
        tx,
      );
    }
    await this.resources.add(listing.sellerHeroId, 'GOLD', netSellerGold(price), tx);

    const updated = await tx.marketListing.update({
      where: { id: listing.id },
      data: {
        state: 'SOLD',
        buyerHeroId: winnerId,
        soldAt: new Date(),
      },
      include: { sellerHero: { select: { name: true } } },
    });
    return this.toDto(updated);
  }

  private toDto(
    row: Prisma.MarketListingGetPayload<{
      include: { sellerHero: { select: { name: true } } };
    }>,
  ): MarketListing {
    return {
      id: row.id,
      sellerHeroId: row.sellerHeroId,
      sellerName: row.sellerHero?.name ?? '',
      listingType: row.listingType as MarketListingType,
      assetType: row.assetType as MarketAssetType,
      resourceType: (row.resourceType as ResourceType | null) ?? null,
      amount: row.amount,
      itemId: row.itemId,
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
