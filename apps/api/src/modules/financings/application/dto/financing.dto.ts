import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength } from "class-validator";

const KINDS = ["CAR", "MOTORCYCLE", "HOUSE", "OTHER"] as const;

export class CreateFinancingDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(KINDS)
  kind!: (typeof KINDS)[number];

  @IsOptional()
  @IsString()
  institution?: string;

  @IsNumber()
  @IsPositive()
  totalAmount!: number;

  @IsNumber()
  @IsPositive()
  installmentAmount!: number;

  @IsInt()
  @Min(1)
  @Max(600)
  installmentsCount!: number;

  @IsDateString()
  firstDueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinancingDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsIn(KINDS) kind?: (typeof KINDS)[number];
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePayoffDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  payoffAmount!: number;

  @IsOptional()
  @IsDateString()
  payoffQuotedAt?: string;
}

export class PayFinancingInstallmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  paidAmount?: number;
}

export class UpdateFinancingInstallmentStatusDto {
  @IsIn(["PENDING", "LATE", "CANCELLED"])
  status!: "PENDING" | "LATE" | "CANCELLED";
}
