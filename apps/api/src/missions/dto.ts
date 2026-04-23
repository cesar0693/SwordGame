import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class StartMissionDto {
  @IsString()
  missionCode!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  consumableItemIds!: string[];
}
