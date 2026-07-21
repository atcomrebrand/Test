function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface FixedJobRevenueInput {
  jobId: string;
  clientLabel: string;
  /** Estimated per-session values (netSeconds/3600 * estimateJobHourlyRate) for this job in the period. */
  sessionValues: number[];
  /** amountBRL from a confirmed TrackingJobPayment for this job/period, or null if not confirmed yet. */
  confirmedAmountBRL: number | null;
}

export interface FixedJobRevenueResult {
  jobId: string;
  clientLabel: string;
  amount: number;
  source: "confirmed" | "estimated";
}

/**
 * Decides, per trabalho fixo per period, whether the revenue attributed to it is the real
 * confirmed monthly payment or the hours-based estimate — the confirmed value always wins once it
 * exists, since a salaried job's real payment can differ from what the hours worked would predict.
 */
export function computeFixedJobRevenue(input: FixedJobRevenueInput): FixedJobRevenueResult {
  if (input.confirmedAmountBRL !== null) {
    return { jobId: input.jobId, clientLabel: input.clientLabel, amount: round2(input.confirmedAmountBRL), source: "confirmed" };
  }
  const estimated = round2(input.sessionValues.reduce((a, b) => a + b, 0));
  return { jobId: input.jobId, clientLabel: input.clientLabel, amount: estimated, source: "estimated" };
}
