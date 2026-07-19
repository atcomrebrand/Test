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

  @IsNumber()
  @IsPositive()
  totalAmount!: number;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  downPayment?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

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
