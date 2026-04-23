import {
  Body,
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
import { MissionsService } from './missions.service';
import { StartMissionDto } from './dto';

@Controller('missions')
@UseGuards(AuthGuard('jwt'))
export class MissionsController {
  constructor(
    private readonly missions: MissionsService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('catalog')
  catalog() {
    return this.missions.listCatalog();
  }

  @Get('active')
  async active(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.missions.activeRun(hero.id);
  }

  @Get('consumables')
  async consumables(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.missions.listConsumables(hero.id);
  }

  @Post('start')
  async start(@CurrentUser() user: JwtPayload, @Body() dto: StartMissionDto) {
    const hero = await this.requireHero(user.sub);
    return this.missions.start(hero.id, dto.missionCode, dto.consumableItemIds);
  }

  @Post(':runId/claim')
  async claim(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    const hero = await this.requireHero(user.sub);
    return this.missions.claim(hero.id, runId);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
