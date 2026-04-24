import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ChallengeDto {
  @IsString()
  defenderHeroId!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  consumableItemIds!: string[];
}
