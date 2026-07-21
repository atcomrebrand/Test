import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

const CATEGORIES = ["DIVIDENDO", "VENDA", "BONIFICACAO", "CASHBACK", "REEMBOLSO", "PRESENTE", "OUTRO"] as const;

export class CreateTrackingIncomeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrackingIncomeDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: (typeof CATEGORIES)[number];
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() notes?: string;
}
