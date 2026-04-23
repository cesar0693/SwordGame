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
import { ForgeService } from './forge.service';
import { CraftRecipeDto } from './dto';

@Controller('forge')
@UseGuards(AuthGuard('jwt'))
export class ForgeController {
  constructor(
    private readonly forge: ForgeService,
    private readonly heroes: HeroesService,
  ) {}

  @Get('state')
  async state(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return {
      blacksmithLevel: await this.forge.blacksmithLevel(hero.id),
    };
  }

  @Get('recipes')
  async recipes(@CurrentUser() user: JwtPayload) {
    const hero = await this.requireHero(user.sub);
    return this.forge.listRecipes(hero.id);
  }

  @Post('recipes/craft')
  async craft(@CurrentUser() user: JwtPayload, @Body() dto: CraftRecipeDto) {
    const hero = await this.requireHero(user.sub);
    return this.forge.craftRecipe(hero.id, dto.code);
  }

  @Post('items/:id/upgrade')
  async upgrade(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.forge.upgrade(hero.id, id);
  }

  @Post('items/:id/salvage')
  async salvage(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const hero = await this.requireHero(user.sub);
    return this.forge.salvage(hero.id, id);
  }

  private async requireHero(userId: string) {
    const hero = await this.heroes.getByUser(userId);
    if (!hero) throw new NotFoundException('Hero not found');
    return hero;
  }
}
