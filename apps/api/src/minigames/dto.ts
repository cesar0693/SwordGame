import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { MINIGAMES, type MinigameCode } from '@swordgame/shared';

export class PlayMinigameDto {
  @IsEnum(MINIGAMES)
  code!: MinigameCode;

  @IsInt()
  @Min(1)
  betGold!: number;

  @IsOptional()
  @IsEnum(['HEADS', 'TAILS'])
  choice?: 'HEADS' | 'TAILS';
}
