import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { MinigamesService } from './minigames.service';
import { PlayMinigameDto } from './dto';

@Controller('minigames')
@UseGuards(AuthGuard('jwt'))
export class MinigamesController {
  constructor(
    private readonly minigames: MinigamesService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('state')
  async state(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.minigames.state(hero.id);
  }

  @Post('play')
  async play(@CurrentUser() user: JwtPayload, @Body() dto: PlayMinigameDto) {
    const hero = await this.requireHero(user.sub);
    return this.minigames.play(hero.id, dto.code, dto.betGold, dto.choice);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
