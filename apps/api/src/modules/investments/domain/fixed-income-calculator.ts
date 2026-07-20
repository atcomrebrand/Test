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
  };
}
