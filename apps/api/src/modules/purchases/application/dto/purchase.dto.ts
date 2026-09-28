import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

const KINDS = ["INSTALLMENT", "CASH", "RECURRING"] as const;
const BILLING_CYCLES = ["MONTHLY", "ANNUAL"] as const;

export class CreatePurchaseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  cardId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Required for CASH (the amount) and RECURRING (the monthly amount) — ignored for INSTALLMENT, where it's computed as installmentAmount × installmentsCount. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalAmount?: number;

  /** Required for INSTALLMENT — the fixed value of each parcela (no total-splitting, no down payment). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;

  /**
   * Purchase date for a brand-new CASH/INSTALLMENT purchase (translated to an invoice month via
   * the card's closing day). For RECURRING, or an INSTALLMENT already `paidInstallmentsCount` in
   * progress, this is instead the due date of the next open charge/parcela, anchored directly —
   * see installment-generator.ts.
   */
  @IsDateString()
  purchaseDate!: string;

  @IsOptional()
  @IsIn(KINDS)
  kind?: (typeof KINDS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  installmentsCount?: number;

  /** INSTALLMENT only: how many parcelas (from #1) are already paid, for a plan already in progress. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidInstallmentsCount?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  /** RECURRING only: MONTHLY (default) or ANNUAL billing — e.g. a domain renewed yearly. */
  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: (typeof BILLING_CYCLES)[number];

  /** RECURRING only: whether it renews automatically. Purely informational — doesn't affect generation. */
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;
}

export class UpdatePurchaseDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() merchant?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isFavorite?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() attachmentUrl?: string;
  @IsOptional() @IsString() attachmentName?: string;
  /** RECURRING only: flip whether it renews automatically, without touching the billing schedule. */
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}

export class ScheduleCancellationDto {
  /** Must be a future date — the subscription keeps charging normally up to and including this month. */
  @IsDateString()
  recurrenceEndDate!: string;
}

export class PurchaseQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cardId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxAmount?: number;
  @IsOptional() @IsIn(KINDS) kind?: (typeof KINDS)[number];
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() favorite?: boolean;
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() trashed?: boolean;
}
