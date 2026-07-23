import { Type } from "class-transformer";
import { IsBoolean, IsHexColor, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateHouseholdCardDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateHouseholdCardDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) closingDay?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpsertHouseholdCardEntryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalInvoice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  provisioned?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHouseholdCardEntryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalInvoice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) provisioned?: number;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsString() notes?: string;
}
