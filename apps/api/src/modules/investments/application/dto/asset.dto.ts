import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from "class-validator";

const ASSET_CLASSES = ["STOCK", "FII", "CRYPTO"] as const;
const TRANSACTION_TYPES = ["BUY", "SELL"] as const;
const INCOME_TYPES = ["DIVIDENDO", "JCP", "RENDIMENTO", "STAKING", "OUTRO"] as const;

export class CreateAssetDto {
  @IsIn(ASSET_CLASSES)
  class!: (typeof ASSET_CLASSES)[number];

  @IsString()
  @MinLength(1)
  ticker!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  broker?: string;

  /** CRYPTO only. */
  @IsOptional()
  @IsString()
  wallet?: string;

  /** CRYPTO only. */
  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Staking APY (% a.a.) — configurable because it varies per exchange, mainly relevant for
   *  stablecoins (USDT, USDC, BUSD...) but usable for any crypto that offers staking. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stakingApyPercent?: number;
}

export class UpdateAssetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() broker?: string;
  @IsOptional() @IsString() wallet?: string;
  @IsOptional() @IsString() network?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) stakingApyPercent?: number;
}

export class CreateTransactionDto {
  @IsIn(TRANSACTION_TYPES)
  type!: (typeof TRANSACTION_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fees?: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddAssetIncomeDto {
  @IsIn(INCOME_TYPES)
  type!: (typeof INCOME_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
