import { IsEnum, IsObject, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { HERO_CLASSES, type HeroAppearance, type HeroClass } from '@swordgame/shared';

export class CreateHeroDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  name!: string;

  @IsEnum(HERO_CLASSES)
  heroClass!: HeroClass;

  @IsObject()
  appearance!: HeroAppearance;
}
