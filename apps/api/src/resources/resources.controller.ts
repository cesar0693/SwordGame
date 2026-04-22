import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { ResourcesService } from './resources.service';

@Controller('resources')
@UseGuards(AuthGuard('jwt'))
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('me')
  async mine(@CurrentUser() user: JwtPayload) {
    const hero = await this.heroes.getByUser(user.sub);
    if (!hero) throw new NotFoundException('Hero not found');
    return this.resources.listByHero(hero.id);
  }
}
