import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from "class-validator";

const TYPES = ["CDB", "LCI", "LCA", "TESOURO", "OUTRO"] as const;
const INDEXERS = ["PREFIXADO", "POS_FIXADO_CDI", "IPCA_MAIS", "OUTRO"] as const;

/** Tetos generosos, mas existentes: 50 anos de projeção já é ficção, e sem limite o servidor
 *  montaria uma série de milhões de pontos por causa de um dígito digitado errado. */
const MAX_MESES = 600;

export class SimulateFixedIncomeDto {
  @Type(() => Number) @IsNumber() @IsPositive() amount!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_MESES) months!: number;
  @IsIn(TYPES) type!: (typeof TYPES)[number];
  @IsIn(INDEXERS) indexer!: (typeof INDEXERS)[number];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) cdiPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) fixedRatePercent?: number;
}

export class SimulateContributionsDto {
  @Type(() => Number) @IsNumber() @Min(0) initialAmount!: number;
  @Type(() => Number) @IsNumber() @Min(0) monthlyAmount!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000) annualRatePercent!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_MESES) months!: number;
  /** Opcional: quando vem, a resposta diz em quantos meses a projeção alcança este valor. */
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() target?: number;
}
