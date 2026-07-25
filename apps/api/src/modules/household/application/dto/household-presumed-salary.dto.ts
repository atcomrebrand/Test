import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsPositive, ValidateIf } from "class-validator";

export class UpsertHouseholdPresumedSalaryDto {
  @IsBoolean()
  isForeignCurrency!: boolean;

  @ValidateIf((o) => !o.isForeignCurrency)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amountBRL?: number;

  @ValidateIf((o) => o.isForeignCurrency)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amountUsd?: number;
}
