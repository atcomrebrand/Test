import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const BILLING_PERIODS = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const;
export const CURRENCIES = ["BRL", "USD"] as const;

export const TEMPLATE_CATEGORIES = [
  "RENEWAL",
  "DUE",
  "DELINQUENCY",
  "RETENTION",
  "SUPPORT",
  "WELCOME",
  "RESELLER",
  "OTHER",
] as const;

export class CreateCrmPortfolioDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  /** Serviço vendido em dólar também é recebido em dólar, e o crédito dele é comprado em dólar. */
  @IsOptional() @IsEnum(CURRENCIES) currency?: (typeof CURRENCIES)[number];
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class UpdateCrmPortfolioDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsEnum(CURRENCIES) currency?: (typeof CURRENCIES)[number];
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateCrmPlanDto {
  @IsString() portfolioId!: string;
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  /** Quantos créditos do painel a renovação deste pacote consome. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) creditCost?: number;
  @IsOptional() @IsEnum(BILLING_PERIODS) billingPeriod?: (typeof BILLING_PERIODS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() customDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class UpdateCrmPlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) creditCost?: number;
  @IsOptional() @IsEnum(BILLING_PERIODS) billingPeriod?: (typeof BILLING_PERIODS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() customDays?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class CreateCrmPaymentMethodDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  /** Percentual, não fração: 3.99 significa 3,99%. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) feePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeFixed?: number;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class UpdateCrmPaymentMethodDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) feePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) feeFixed?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class CreateCrmOriginDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
}

export class UpdateCrmOriginDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateCrmTagDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsOptional() @IsHexColor() color?: string;
}

export class CreateCrmTemplateDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsEnum(TEMPLATE_CATEGORIES) category?: (typeof TEMPLATE_CATEGORIES)[number];
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
  @IsOptional() @IsBoolean() forReseller?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class UpdateCrmTemplateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsEnum(TEMPLATE_CATEGORIES) category?: (typeof TEMPLATE_CATEGORIES)[number];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) body?: string;
  @IsOptional() @IsBoolean() forReseller?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class UpdateCrmSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vipMinMonths?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) vipMinRevenue?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vipMinRenewals?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) resellerAttentionDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) resellerInactiveDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultLowCreditThreshold?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) panelLowCreditThreshold?: number;
  @IsOptional() @IsBoolean() deductResellerRechargesFromPanel?: boolean;
}
