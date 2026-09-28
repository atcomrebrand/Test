import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

const PERCENT = { min: 0, max: 100 };

export class SettingsDto {
  @IsOptional() @IsBoolean() taxEnabled?: boolean;
  @IsOptional() @IsIn(["PERCENT", "FIXED"]) taxMode?: "PERCENT" | "FIXED";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(PERCENT.max) taxPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxMonthly?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(99.99) defaultMarginPercent?: number;
}

export class FixedCostDto {
  @IsString() @MinLength(1) name!: string;
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ChannelDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsIn(["MARKETPLACE", "DIRECT", "OWN_STORE", "WHOLESALE"]) type?: "MARKETPLACE" | "DIRECT" | "OWN_STORE" | "WHOLESALE";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(PERCENT.max) feePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeFixed?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) shippingCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(PERCENT.max) returnRatePercent?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ProductDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() sku?: string;
  @Type(() => Number) @IsNumber() @Min(0) cost!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) packagingCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) extraCost?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** `price: null` limpa o preço e faz o canal voltar a mostrar o sugerido — por isso ele é opcional
 *  e nulável, e não simplesmente ausente. */
export class ProductChannelPriceDto {
  @IsString() channelId!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(99.99) targetMarginPercent?: number | null;
}

/** A calculadora avulsa. Nada aqui é gravado. */
export class SimulateDto {
  @Type(() => Number) @IsNumber() @Min(0) cost!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) packagingCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) extraCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) shippingCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(PERCENT.max) feePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeFixed?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(PERCENT.max) returnRatePercent?: number;
  /** Ausente = a simulação usa o preço sugerido pela margem desejada. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(PERCENT.min) @Max(99.99) targetMarginPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) targetProfit?: number;
}
