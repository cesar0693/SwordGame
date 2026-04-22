import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { ItemsService } from './items.service';

@Controller('items')
@UseGuards(AuthGuard('jwt'))
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('me')
  async mine(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.items.listByHero(hero.id);
  }

  @Post(':id/equip')
  async equip(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.items.equip(hero.id, id);
  }

  @Post(':id/unequip')
  async unequip(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.items.unequip(hero.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async drop(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    await this.items.drop(hero.id, id);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
