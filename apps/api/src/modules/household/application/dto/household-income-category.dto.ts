import { IsHexColor, IsOptional, IsString, MinLength } from "class-validator";

export class CreateHouseholdIncomeCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateHouseholdIncomeCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class ReorderHouseholdIncomeCategoriesDto {
  @IsString({ each: true })
  ids!: string[];
}
