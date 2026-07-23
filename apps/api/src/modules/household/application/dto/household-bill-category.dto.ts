import { IsHexColor, IsOptional, IsString, MinLength } from "class-validator";

export class CreateHouseholdBillCategoryDto {
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

export class UpdateHouseholdBillCategoryDto {
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

export class ReorderHouseholdBillCategoriesDto {
  @IsString({ each: true })
  ids!: string[];
}
