import { FixedIncomeIndexer, FixedIncomeType } from "@prisma/client";

/** Standard Brazilian regressive IOF table — % of the gross yield retained, by day held (1-30).
 *  Day 30 onward: 0% (IOF only applies to redemptions within 30 days of application). */
const IOF_TABLE_BY_DAY: Record<number, number> = {
  1: 96, 2: 93, 3: 90, 4: 86, 5: 83, 6: 80, 7: 76, 8: 73, 9: 70, 10: 66,
  11: 63, 12: 60, 13: 56, 14: 53, 15: 50, 16: 46, 17: 43, 18: 40, 19: 36, 20: 33,
  21: 30, 22: 26, 23: 23, 24: 20, 25: 16, 26: 13, 27: 10, 28: 6, 29: 3,
};

/** IR regressive table — types exempt from IR for individual investors (LCI/LCA) always return 0. */
const IR_EXEMPT_TYPES: FixedIncomeType[] = ["LCI", "LCA"];

export interface FixedIncomeCalculationInput {
  principalAmount: number;
  /** Dinheiro que o usuário efetivamente aportou e ainda está aqui. Só difere do principalAmount
   *  depois de um resgate parcial, quando o principal vira uma base de rendimento em vez do
   *  dinheiro colocado. Omitido = os dois são a mesma coisa. */
  contributedAmount?: number | null;
  applicationDate: Date;
  /** Date to value as of — "today" for the live dashboard, or a hypothetical redemption date. */
  asOfDate: Date;
  type: FixedIncomeType;
  indexer: FixedIncomeIndexer;
  fixedRatePercent?: number | null;
  cdiPercent?: number | null;
  /** Current annualized CDI rate (%), required for POS_FIXADO_CDI. */
  cdiAnnualRate?: number | null;
  /** Current 12-month accumulated IPCA rate (%), required for IPCA_MAIS. */
  ipcaAnnualRate?: number | null;
}

export interface FixedIncomeCalculationResult {
  daysElapsed: number;
  grossValue: number;
  grossYield: number;
  iofRate: number;
  iofAmount: number;
  irRate: number;
  irAmount: number;
  netYield: number;
  netValue: number;
  grossProfitabilityPercent: number;
  netProfitabilityPercent: number;
  /** O que o usuário pôs de dinheiro e ainda está aqui — é isso que a tela chama de "Investido". */
  contributedAmount: number;
  /** Ganho de verdade: o que dá pra sacar hoje menos o que foi aportado. Sem resgate parcial é
   *  idêntico ao netYield; depois de um, é ele que bate com o extrato, porque o netYield mede
   *  contra a base de rendimento (inflada pelo juro que já tinha rendido) e não contra o aporte. */
  netGain: number;
  netGainPercent: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function compound(principal: number, annualRatePercent: number, days: number): number {
  return principal * Math.pow(1 + annualRatePercent / 100, days / 365);
}

function irRateForDays(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20;
  if (days <= 720) return 17.5;
  return 15;
}

function iofRateForDays(days: number): number {
  if (days >= 30) return 0;
  return IOF_TABLE_BY_DAY[Math.max(1, days)] ?? 0;
}

function grossValueFor(input: FixedIncomeCalculationInput, days: number): number {
  const { principalAmount, indexer, fixedRatePercent, cdiPercent, cdiAnnualRate, ipcaAnnualRate } = input;

  switch (indexer) {
    case "PREFIXADO":
      return compound(principalAmount, fixedRatePercent ?? 0, days);
    case "POS_FIXADO_CDI": {
      const effectiveAnnual = (cdiAnnualRate ?? 0) * ((cdiPercent ?? 100) / 100);
      return compound(principalAmount, effectiveAnnual, days);
    }
    case "IPCA_MAIS": {
      const withIpca = compound(principalAmount, ipcaAnnualRate ?? 0, days);
      return compound(withIpca, fixedRatePercent ?? 0, days);
    }
    case "OUTRO":
    default:
      return compound(principalAmount, fixedRatePercent ?? 0, days);
  }
}

/**
 * The "grande diferencial" of the renda fixa module: every application always exposes both
 * bruto and líquido values, with IR and IOF broken out — never just the gross number.
 *
 * IOF (when redeeming within 30 days) is deducted from the gross yield first; IR is then applied
 * on what remains, matching how Receita Federal actually orders the two. LCI/LCA are IR-exempt
 * for individual investors regardless of holding period.
 */
export function calculateFixedIncome(input: FixedIncomeCalculationInput): FixedIncomeCalculationResult {
  const days = daysBetween(input.applicationDate, input.asOfDate);
  const grossValue = grossValueFor(input, days);
  const grossYield = grossValue - input.principalAmount;

  const iofRate = iofRateForDays(days);
  const iofAmount = grossYield > 0 ? grossYield * (iofRate / 100) : 0;
  const yieldAfterIof = grossYield - iofAmount;

  const isIrExempt = IR_EXEMPT_TYPES.includes(input.type);
  const irRate = isIrExempt ? 0 : irRateForDays(days);
  const irAmount = yieldAfterIof > 0 ? yieldAfterIof * (irRate / 100) : 0;

  const netYield = grossYield - iofAmount - irAmount;
  const netValue = input.principalAmount + netYield;

  const contributedAmount = input.contributedAmount ?? input.principalAmount;
  const netGain = netValue - contributedAmount;

  return {
    daysElapsed: days,
    grossValue,
    grossYield,
    iofRate,
    iofAmount,
    irRate,
    irAmount,
    netYield,
    netValue,
    grossProfitabilityPercent: input.principalAmount > 0 ? (grossYield / input.principalAmount) * 100 : 0,
    netProfitabilityPercent: input.principalAmount > 0 ? (netYield / input.principalAmount) * 100 : 0,
    contributedAmount,
    netGain,
    netGainPercent: contributedAmount > 0 ? (netGain / contributedAmount) * 100 : 0,
  };
}

/**
 * Inverts calculateFixedIncome's linearity for a partial redemption: given the full position's
 * current principal and net value, finds how much principal needs to be split off so that slice's
 * net value equals `targetNetValue` — the cash the user actually wants to walk away with today,
 * not a slice of the original principal. May return a value greater than `fullPrincipal` when the
 * target exceeds what's available; callers must guard that case (nothing to redeem against).
 */
export function principalForTargetNetValue(fullPrincipal: number, fullNetValue: number, targetNetValue: number): number {
  if (fullPrincipal <= 0 || fullNetValue <= 0) return 0;
  return (targetNetValue / fullNetValue) * fullPrincipal;
}

/**
 * Divide o dinheiro aportado entre a fatia sacada e o que fica, em regime de caixa: quem saca
 * R$ 2.000 de um CDB onde pôs R$ 10.000 está tirando R$ 2.000 do próprio dinheiro — sobram
 * R$ 8.000 aportados, exatamente como o banco mostra. O ganho só aparece quando o saque passa de
 * tudo que foi aportado; daí a fatia leva o aporte inteiro e o resto (o lucro) fica com ela.
 *
 * Isso é deliberadamente diferente de como o principalAmount se divide num resgate parcial: lá a
 * divisão é proporcional porque ele é a base que rende juro, e o valor bruto/líquido tem que
 * continuar fechando cent a cent. As duas coisas coexistem — uma diz quanto vale, a outra quanto
 * custou.
 */
export function splitContribution(contributed: number, withdrawnNetAmount: number): { withdrawn: number; remaining: number } {
  const base = Math.max(0, contributed);
  const withdrawn = Math.min(Math.max(0, withdrawnNetAmount), base);
  return { withdrawn, remaining: base - withdrawn };
}
