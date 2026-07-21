export interface HourlyRateBreakdownInput {
  /** Sum of the net-value of every trabalho-fixo session in the period. */
  fixedJobsRevenue: number;
  /** Sum of every trabalho-fixo session's netSeconds in the period. */
  fixedJobsSeconds: number;
  /** Sum of every freela/projeto extra's amountReceived in the period. */
  freelanceRevenue: number;
  /** Sum of every freela/projeto extra's hoursSpent in the period (manually entered, not timed). */
  freelanceHours: number;
  /** Sum of "outras entradas" in the period — counts toward revenue, never toward hours. */
  otherIncome: number;
}

export interface HourlyRateResult {
  totalRevenue: number;
  totalHours: number;
  /** null when no hours were worked in the period — an average would be meaningless (or divide by 0). */
  averageHourlyRate: number | null;
  fixedJobsRevenue: number;
  freelanceRevenue: number;
  otherIncome: number;
}

/**
 * The core "valor real da hora" calculation: total revenue (trabalhos fixos + freelas + outras
 * entradas) divided by total hours worked (trabalhos fixos + freelas — outras entradas never
 * contribute hours). Same formula whether called for "tudo", "somente trabalhos fixos" (pass 0 for
 * the freelance/other fields), a single cliente/empresa, or a custom date range — the caller is
 * responsible for pre-filtering which sessions/projects/incomes feed into these sums.
 */
export function computeHourlyRateBreakdown(input: HourlyRateBreakdownInput): HourlyRateResult {
  const { fixedJobsRevenue, fixedJobsSeconds, freelanceRevenue, freelanceHours, otherIncome } = input;

  const fixedJobsHours = fixedJobsSeconds / 3600;
  const totalHours = fixedJobsHours + freelanceHours;
  const totalRevenue = fixedJobsRevenue + freelanceRevenue + otherIncome;

  return {
    totalRevenue: round2(totalRevenue),
    totalHours: round2(totalHours),
    averageHourlyRate: totalHours > 0 ? round2(totalRevenue / totalHours) : null,
    fixedJobsRevenue: round2(fixedJobsRevenue),
    freelanceRevenue: round2(freelanceRevenue),
    otherIncome: round2(otherIncome),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
