import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AUCTION_DURATIONS_HOURS,
  RESOURCE_TYPES,
  type AuctionDurationHours,
  type MarketListingType,
  type ResourceType,
} from '@swordgame/shared';

const LISTING_TYPES: MarketListingType[] = ['INSTANT_BUY', 'AUCTION'];

export class CreateResourceListingDto {
  @IsEnum(LISTING_TYPES)
  listingType!: MarketListingType;

  @IsEnum(RESOURCE_TYPES)
  resourceType!: ResourceType;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsInt()
  @Min(1)
  priceGold!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  buyoutGold?: number;

  @ValidateIf((o: CreateResourceListingDto) => o.listingType === 'AUCTION')
  @IsEnum(AUCTION_DURATIONS_HOURS)
  durationHours?: AuctionDurationHours;
}

export class CreateItemListingDto {
  @IsEnum(LISTING_TYPES)
  listingType!: MarketListingType;

  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  priceGold!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  buyoutGold?: number;

  @ValidateIf((o: CreateItemListingDto) => o.listingType === 'AUCTION')
  @IsEnum(AUCTION_DURATIONS_HOURS)
  durationHours?: AuctionDurationHours;
}

export class PlaceBidDto {
  @IsInt()
  @Min(1)
  amount!: number;
}
