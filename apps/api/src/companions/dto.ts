import { IsEnum, IsString } from 'class-validator';
import type { SkillAxis } from '@swordgame/shared';

const AXES: SkillAxis[] = ['QUANTITY', 'SPEED'];

export class SetTrackDto {
  @IsString()
  trackCode!: string;
}

export class SpendSkillDto {
  @IsString()
  trackCode!: string;

  @IsEnum(AXES)
  axis!: SkillAxis;
}
