export interface StakingCalculationInput {
  investedAmount: number;
  apyPercent: number;
  /** Anchor date to accrue from — the asset's first BUY transaction. */
  sinceDate: Date;
  asOfDate: Date;
}

export interface StakingCalculationResult {
  daysHeld: number;
  estimatedYield: number;
  estimatedValue: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Estimated staking yield accrued since the asset was first bought, compounded daily at the
 * user-configured APY. This is an ESTIMATE, not a realized amount — staking rates and payout
 * schedules vary per exchange, so it's shown separately from profit/dashboard totals rather than
 * folded into them. Real payouts should be logged as a STAKING income entry when received.
 */
export function calculateStakingYield(input: StakingCalculationInput): StakingCalculationResult {
  const daysHeld = daysBetween(input.sinceDate, input.asOfDate);
  const estimatedValue = input.investedAmount * Math.pow(1 + input.apyPercent / 100, daysHeld / 365);
  return {
    daysHeld,
    estimatedYield: estimatedValue - input.investedAmount,
    estimatedValue,
  };
}
