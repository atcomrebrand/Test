import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { BILLING_PERIODS } from "./crm-catalog.dto";

const MANUAL_STATUSES = ["CANCELLED", "INACTIVE", "RECOVERY"] as const;

export class CreateCrmCustomerDto {
  @IsString() portfolioId!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) nickname?: string;
  @IsString() @MinLength(8) @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) document?: string;
  @IsOptional() @IsString() originId?: string;
  @IsOptional() @IsString() referredById?: string;
  @IsOptional() @IsDateString() trialEndsAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
}

export class UpdateCrmCustomerDto {
  @IsOptional() @IsString() portfolioId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) nickname?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) document?: string;
  @IsOptional() @IsString() originId?: string;
  @IsOptional() @IsString() referredById?: string;
  @IsOptional() @IsDateString() trialEndsAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
  /** Só os deliberados; os demais são calculados e o endpoint recusa. */
  @IsOptional() @IsEnum(MANUAL_STATUSES) manualStatus?: (typeof MANUAL_STATUSES)[number] | null;
  @IsOptional() @IsBoolean() vipManual?: boolean;
}

export class CreateCrmSubscriptionDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() planId?: string;
  @IsDateString() startDate!: string;
  @IsDateString() dueDate!: string;
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsEnum(BILLING_PERIODS) billingPeriod?: (typeof BILLING_PERIODS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customDays?: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateCrmSubscriptionDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsEnum(BILLING_PERIODS) billingPeriod?: (typeof BILLING_PERIODS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customDays?: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

/**
 * Renovação. Tudo é opcional de propósito: o caso de uso é um clique, então valor, forma de
 * pagamento e período saem da própria assinatura quando não vierem.
 */
export class RenewSubscriptionDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsEnum(BILLING_PERIODS) billingPeriod?: (typeof BILLING_PERIODS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customDays?: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateCrmPaymentDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() subscriptionId?: string;
  @IsDateString() paidAt!: string;
  @Type(() => Number) @IsNumber() @Min(0) grossAmount!: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CancelCustomerDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
