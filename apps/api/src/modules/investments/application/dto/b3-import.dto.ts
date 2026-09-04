import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from "class-validator";

const ASSET_CLASSES = ["STOCK", "FII"] as const;
const TRANSACTION_TYPES = ["BUY", "SELL"] as const;
const INCOME_TYPES = ["DIVIDENDO", "JCP", "RENDIMENTO", "OUTRO"] as const;

/** Raw spreadsheet rows are validated defensively inside the pure domain parser (unknown-typed
 *  fields, malformed cells become skipped rows instead of request errors), so the DTO here only
 *  guards the request shape — an array of plain row objects, capped to a sane size. */
export class B3ImportPreviewDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  negociacao?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  movimentacao?: Record<string, unknown>[];
}

export class CsvImportPreviewDto {
  @IsArray()
  @ArrayMaxSize(5000)
  rows!: Record<string, unknown>[];
}

export class ImportTransactionInputDto {
  @IsString()
  ticker!: string;

  @IsIn(ASSET_CLASSES)
  assetClass!: (typeof ASSET_CLASSES)[number];

  @IsOptional()
  @IsString()
  assetName?: string;

  @IsIn(TRANSACTION_TYPES)
  type!: (typeof TRANSACTION_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsString()
  sourceLabel?: string;
}

export class ImportIncomeInputDto {
  @IsString()
  ticker!: string;

  @IsIn(ASSET_CLASSES)
  assetClass!: (typeof ASSET_CLASSES)[number];

  @IsOptional()
  @IsString()
  assetName?: string;

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
  sourceLabel?: string;
}

export class B3ImportCommitDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportTransactionInputDto)
  transactions!: ImportTransactionInputDto[];

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportIncomeInputDto)
  incomes!: ImportIncomeInputDto[];
}
