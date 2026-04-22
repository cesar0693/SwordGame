import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  type MarketListingType,
  type ResourceType,
  RESOURCE_TYPES,
} from '@swordgame/shared';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { MarketService } from './market.service';
import { CreateResourceListingDto, PlaceBidDto } from './dto';

@Controller('market')
@UseGuards(AuthGuard('jwt'))
export class MarketController {
  constructor(
    private readonly market: MarketService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('listings')
  async listings(
    @Query('resourceType') resourceType?: string,
    @Query('listingType') listingType?: string,
  ) {
    return this.market.listActive({
      resourceType: this.parseResource(resourceType),
      listingType: this.parseType(listingType),
    });
  }

  @Get('mine')
  async mine(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.market.listMine(hero.id);
  }

  @Post('listings/resource')
  async createResourceListing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateResourceListingDto,
  ) {
    const hero = await this.requireHero(user.sub);
    return this.market.createResourceListing(hero.id, dto);
  }

  @Post('listings/:id/buy')
  async buy(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.market.buy(hero.id, id);
  }

  @Post('listings/:id/bid')
  async bid(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PlaceBidDto,
  ) {
    const hero = await this.requireHero(user.sub);
    return this.market.placeBid(hero.id, id, dto.amount);
  }

  @Delete('listings/:id')
  async cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.market.cancel(hero.id, id);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }

  private parseResource(raw?: string): ResourceType | undefined {
    if (!raw) return undefined;
    if (!(RESOURCE_TYPES as readonly string[]).includes(raw)) return undefined;
    return raw as ResourceType;
  }

  private parseType(raw?: string): MarketListingType | undefined {
    if (raw === 'INSTANT_BUY' || raw === 'AUCTION') return raw;
    return undefined;
  }
}
