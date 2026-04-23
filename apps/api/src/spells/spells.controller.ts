import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SPELL_CATALOG } from '@swordgame/shared';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { SpellsService } from './spells.service';

@Controller('spells')
@UseGuards(AuthGuard('jwt'))
export class SpellsController {
  constructor(
    private readonly spells: SpellsService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('catalog')
  catalog() {
    return SPELL_CATALOG;
  }

  @Get('me')
  async mine(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.spells.listByHero(hero.id);
  }

  @Post(':code/equip')
  async equip(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    const hero = await this.requireHero(user.sub);
    return this.spells.equip(hero.id, code);
  }

  @Post(':code/unequip')
  async unequip(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    const hero = await this.requireHero(user.sub);
    return this.spells.unequip(hero.id, code);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
