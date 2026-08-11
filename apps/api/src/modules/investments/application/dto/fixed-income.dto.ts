import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from "class-validator";

const TYPES = ["CDB", "LCI", "LCA", "TESOURO", "OUTRO"] as const;
const LIQUIDITIES = ["DIARIA", "NO_VENCIMENTO", "OUTRO"] as const;
const INDEXERS = ["PREFIXADO", "POS_FIXADO_CDI", "IPCA_MAIS", "OUTRO"] as const;
const INCOME_TYPES = ["JUROS", "OUTRO"] as const;

export class CreateFixedIncomeDto {
  @IsString()
  @MinLength(1)
  institution!: string;

  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  principalAmount!: number;

  @IsDateString()
  applicationDate!: string;

  @IsDateString()
  maturityDate!: string;

  @IsIn(LIQUIDITIES)
  liquidity!: (typeof LIQUIDITIES)[number];

  @IsIn(INDEXERS)
  indexer!: (typeof INDEXERS)[number];

  /** Required for PREFIXADO/IPCA_MAIS, ignored otherwise. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fixedRatePercent?: number;

  /** Required for POS_FIXADO_CDI (e.g. 110 = 110% do CDI), ignored otherwise. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cdiPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFixedIncomeDto {
  @IsOptional() @IsString() @MinLength(1) institution?: string;
  @IsOptional() @IsString() notes?: string;

  /**
   * Data de aplicação. Editável porque um erro de um dia aqui desloca IOF, IR e a janela inteira
   * do CDI — e antes só dava pra corrigir por SQL direto no banco. É o campo que mais custa caro
   * pra errar e o único que não tinha como consertar pela tela.
   */
  @IsOptional() @IsDateString() applicationDate?: string;

  /** Vencimento. Anda junto: quem digitou a aplicação errada normalmente errou o vencimento também. */
  @IsOptional() @IsDateString() maturityDate?: string;

  /** % do CDI do papel. Um "130" digitado como "13" só aparece semanas depois, na divergência. */
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() cdiPercent?: number;

  /** Base de rendimento. Corrigir isso à mão é o caminho documentado pra alinhar com o extrato
   *  depois de um resgate parcial — ver a seção de renda fixa no CLAUDE.md. */
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() principalAmount?: number;
}

export class RedeemFixedIncomeDto {
  @IsOptional()
  @IsDateString()
  redeemedAt?: string;

  /** Partial redemption target, in reais — the net cash the user wants to receive today, not a
   *  slice of principal. Omit to redeem everything (full net value). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;
}

export class AddFixedIncomeInterestDto {
  @IsOptional()
  @IsIn(INCOME_TYPES)
  type?: (typeof INCOME_TYPES)[number];

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
