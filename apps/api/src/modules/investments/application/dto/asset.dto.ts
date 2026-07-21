import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength } from "class-validator";

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
}

export class UpdateAssetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() broker?: string;
  @IsOptional() @IsString() wallet?: string;
  @IsOptional() @IsString() network?: string;
  @IsOptional() @IsString() notes?: string;
  /** Staking APY (% a.a.) — configurable because it varies per exchange, mainly relevant for
   *  stablecoins (USDT, USDC, BUSD...) but usable for any crypto that offers staking. Only ever
   *  set via the dedicated "Staking" button (never asked at creation), since it's not something
   *  most people know off-hand when first registering an asset. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) stakingApyPercent?: number;
  /** % of the position actually staked (0-100) — set alongside stakingApyPercent. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) stakingPercent?: number;
  @IsOptional() @IsBoolean() favorite?: boolean;
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

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: (typeof TRANSACTION_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fees?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

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

export class UpdateIncomeDto {
  @IsOptional()
  @IsIn(INCOME_TYPES)
  type?: (typeof INCOME_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
