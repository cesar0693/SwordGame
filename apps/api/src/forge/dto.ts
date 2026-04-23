import { IsString } from 'class-validator';

export class CraftRecipeDto {
  @IsString()
  code!: string;
}
