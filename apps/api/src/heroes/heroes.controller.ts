import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AllocatableStat } from '@swordgame/shared';
import { HeroesService } from './heroes.service';
import { CreateHeroDto } from './dto';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

@Controller('heroes')
@UseGuards(AuthGuard('jwt'))
export class HeroesController {
  constructor(private readonly heroes: HeroesService) {}

  @Get('me')
  async getMine(@CurrentUser() user: JwtPayload) {
    return this.heroes.getByUser(user.sub);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateHeroDto) {
    return this.heroes.create(user.sub, dto);
  }

  @Post('allocate/:stat')
  async allocate(
    @CurrentUser() user: JwtPayload,
    @Param('stat') stat: string,
  ) {
    return this.heroes.allocatePoint(user.sub, stat as AllocatableStat);
  }
}
