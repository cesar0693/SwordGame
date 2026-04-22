import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { COMPANION_ROLES, type CompanionRole } from '@swordgame/shared';

export class RoleParamDto {
  @IsEnum(COMPANION_ROLES)
  role!: CompanionRole;
}

export class PickPerkDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  code!: string;
}
