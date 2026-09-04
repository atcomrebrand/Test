import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

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

  /** Due date of the next unpaid installment (or installment #1, if none have been paid yet). */
  @IsDateString()
  nextDueDate!: string;

  /** How many installments (from #1) are already paid — for financing already in progress. Omit/0 for a brand-new one. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidInstallmentsCount?: number;

  /** Optional cash-payoff quote ("quitação à vista") to store right away, instead of adding it later. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  payoffAmount?: number;

  @IsOptional()
  @IsDateString()
  payoffQuotedAt?: string;

  /** Quanto o bem vale hoje (FIPE/avaliação) — opcional já na criação, pra não obrigar duas telas. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assetValue?: number;

  @IsOptional()
  @IsDateString()
  assetValueAt?: string;

  @IsOptional()
  @IsString()
  assetValueSource?: string;

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

export class UpdateAssetValueDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assetValue!: number;

  @IsOptional()
  @IsDateString()
  valuedAt?: string;

  /** De onde veio o número: "Tabela FIPE", "Avaliação da imobiliária"… texto livre. */
  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateAssetPhotoDto {
  /** Data URL da foto, ou `null` pra remover. O campo é obrigatório (não `@IsOptional`) pra que
   *  "remover" seja sempre explícito — um corpo vazio por engano não deve apagar a foto. */
  @ValidateIf((o) => o.photo !== null)
  @IsString()
  @IsNotEmpty()
  photo!: string | null;
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
