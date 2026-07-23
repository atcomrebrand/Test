import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength } from "class-validator";

export class CreateHouseholdBillDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  defaultAmount!: number;

  @IsOptional()
  @IsBoolean()
  allowAmountChange?: boolean;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHouseholdBillDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() defaultAmount?: number;
  @IsOptional() @IsBoolean() allowAmountChange?: boolean;
  @IsOptional() @IsBoolean() mandatory?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateHouseholdBillEntryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
