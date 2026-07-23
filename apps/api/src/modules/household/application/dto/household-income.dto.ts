import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateHouseholdIncomeDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHouseholdIncomeDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsString() notes?: string;
}
