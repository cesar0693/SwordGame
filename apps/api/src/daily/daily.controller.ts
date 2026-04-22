import { Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { DailyService } from './daily.service';

@Controller('daily')
@UseGuards(AuthGuard('jwt'))
export class DailyController {
  constructor(
    private readonly daily: DailyService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('state')
  async state(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.daily.getState(hero.id);
  }

  @Post('claim')
  async claim(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.daily.claim(hero.id);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
