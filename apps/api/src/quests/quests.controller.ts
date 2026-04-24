import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { QuestsService } from './quests.service';

@Controller('quests')
@UseGuards(AuthGuard('jwt'))
export class QuestsController {
  constructor(
    private readonly quests: QuestsService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('today')
  async today(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.quests.listToday(hero.id);
  }

  @Post(':code/claim')
  async claim(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    const hero = await this.requireHero(user.sub);
    return this.quests.claim(hero.id, code);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
