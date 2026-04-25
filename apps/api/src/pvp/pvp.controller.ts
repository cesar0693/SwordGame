import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { PvpService } from './pvp.service';
import { ChallengeDto } from './dto';

@Controller('pvp')
@UseGuards(AuthGuard('jwt'))
export class PvpController {
  constructor(
    private readonly pvp: PvpService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('leaderboard')
  async leaderboard(@Query('limit') limitRaw?: string) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);
    return this.pvp.leaderboard(limit);
  }

  @Get('cooldown')
  async cooldown(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.pvp.cooldown(hero.id);
  }

  @Get('matches')
  async matches(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.pvp.listMatches(hero.id);
  }

  @Post('challenge')
  // The 5-min cooldown is the real gate. This bucket just prevents
  // a flood of probes against the cooldown check itself.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async challenge(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChallengeDto,
  ) {
    const hero = await this.requireHero(user.sub);
    return this.pvp.challenge(hero.id, dto.defenderHeroId, dto.consumableItemIds);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
