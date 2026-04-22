import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { COMPANION_ROLES, type CompanionRole } from '@swordgame/shared';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { HeroesService } from '../heroes/heroes.service';
import { CompanionsService } from './companions.service';
import { SetTrackDto, SpendSkillDto } from './dto';

@Controller('companions')
@UseGuards(AuthGuard('jwt'))
export class CompanionsController {
  constructor(
    private readonly companions: CompanionsService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('me')
  async mine(@CurrentUser() user: JwtPayload) {
    const hero = await this.heroes.getByUser(user.sub);
    if (!hero) throw new NotFoundException('Hero not found');
    return this.companions.listByHero(hero.id);
  }

  @Post(':role/unlock')
  async unlock(@CurrentUser() user: JwtPayload, @Param('role') role: string) {
    const hero = await this.requireHero(user.sub);
    return this.companions.unlock(hero.id, this.parseRole(role));
  }

  @Post(':role/start')
  async start(@CurrentUser() user: JwtPayload, @Param('role') role: string) {
    const hero = await this.requireHero(user.sub);
    return this.companions.startCycle(hero.id, this.parseRole(role));
  }

  @Post(':role/claim')
  async claim(@CurrentUser() user: JwtPayload, @Param('role') role: string) {
    const hero = await this.requireHero(user.sub);
    return this.companions.claim(hero.id, this.parseRole(role));
  }

  @Post(':role/track')
  async setTrack(
    @CurrentUser() user: JwtPayload,
    @Param('role') role: string,
    @Body() dto: SetTrackDto,
  ) {
    const hero = await this.requireHero(user.sub);
    return this.companions.setActiveTrack(hero.id, this.parseRole(role), dto.trackCode);
  }

  @Post(':role/skill')
  async spend(
    @CurrentUser() user: JwtPayload,
    @Param('role') role: string,
    @Body() dto: SpendSkillDto,
  ) {
    const hero = await this.requireHero(user.sub);
    return this.companions.spendSkill(
      hero.id,
      this.parseRole(role),
      dto.trackCode,
      dto.axis,
    );
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }

  private parseRole(raw: string): CompanionRole {
    if (!(COMPANION_ROLES as readonly string[]).includes(raw)) {
      throw new BadRequestException('Unknown companion role');
    }
    return raw as CompanionRole;
  }
}
