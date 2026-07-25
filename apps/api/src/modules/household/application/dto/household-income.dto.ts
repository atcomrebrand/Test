import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsPositive, IsString, ValidateIf } from "class-validator";

export class CreateHouseholdIncomeDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Sempre digitado pelo usuário, mesmo quando isForeignCurrency é true — o bruto/cotação abaixo
   *  são só referência, nunca substituem o valor que a pessoa efetivamente recebeu. */
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsBoolean()
  isForeignCurrency?: boolean;

  @ValidateIf((o) => o.isForeignCurrency)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  grossAmountForeign?: number;

  @ValidateIf((o) => o.isForeignCurrency)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHouseholdIncomeDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsBoolean() isForeignCurrency?: boolean;
  @ValidateIf((o) => o.isForeignCurrency) @Type(() => Number) @IsNumber() @IsPositive() grossAmountForeign?: number;
  @ValidateIf((o) => o.isForeignCurrency) @Type(() => Number) @IsNumber() @IsPositive() exchangeRate?: number;
  @IsOptional() @IsString() notes?: string;
}
