import { HistoricalPricePoint, DividendEvent, AnnualIncomeEntry } from "./market-data.provider";

// ---------------------------------------------------------------------------
// Preço justo de Graham
// ---------------------------------------------------------------------------

export interface GrahamResult {
  currentPrice: number;
  fairPrice: number;
  /** Percent above (positive) or below (negative) the fair price the current price sits at. */
  upsidePercent: number;
}

/** Benjamin Graham's classic fair-value formula: sqrt(22.5 * LPA * VPA). Only meaningful for
 *  profitable companies with positive book value — a loss-making year or negative equity makes
 *  the formula produce nonsense (sqrt of a negative number), so this returns null rather than a
 *  misleading number in that case. */
export function computeGrahamFairPrice(currentPrice: number, earningsPerShare: number | null, bookValuePerShare: number | null): GrahamResult | null {
  if (earningsPerShare === null || bookValuePerShare === null) return null;
  if (earningsPerShare <= 0 || bookValuePerShare <= 0) return null;
  const fairPrice = Math.sqrt(22.5 * earningsPerShare * bookValuePerShare);
  return {
    currentPrice,
    fairPrice: Math.round(fairPrice * 100) / 100,
    upsidePercent: Math.round(((fairPrice - currentPrice) / currentPrice) * 1000) / 10,
  };
}

// ---------------------------------------------------------------------------
// Teto de Bazin
// ---------------------------------------------------------------------------

export interface BazinResult {
  currentPrice: number;
  ceilingPrice: number;
}

/** Décio Bazin's ceiling-price method: the highest price that still delivers the target dividend
 *  yield (classically 6% a.a.) off the asset's average annual dividend. Paying more than the
 *  ceiling means accepting a yield below the target. */
export function computeBazinCeiling(currentPrice: number, averageAnnualDividendPerShare: number | null, targetYieldPercent = 6): BazinResult | null {
  if (averageAnnualDividendPerShare === null || averageAnnualDividendPerShare <= 0) return null;
  const ceilingPrice = averageAnnualDividendPerShare / (targetYieldPercent / 100);
  return { currentPrice, ceilingPrice: Math.round(ceilingPrice * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Rentabilidade por período
// ---------------------------------------------------------------------------

export type ProfitabilityPeriod = "1M" | "3M" | "1A" | "2A" | "5A" | "10A";

const PERIOD_MONTHS: Record<ProfitabilityPeriod, number> = { "1M": 1, "3M": 3, "1A": 12, "2A": 24, "5A": 60, "10A": 120 };

/** Finds the closest history point to a target date, but only within a tolerance — otherwise a
 *  ticker with only 2 years of history would silently report a "10 year return" using its very
 *  first data point, which is not the same thing and shouldn't be presented as one. */
function closestPointWithinTolerance(history: HistoricalPricePoint[], targetDate: Date, toleranceDays: number): HistoricalPricePoint | null {
  if (history.length === 0) return null;
  let best: HistoricalPricePoint | null = null;
  let bestDiffMs = Infinity;
  for (const point of history) {
    const diffMs = Math.abs(new Date(point.date).getTime() - targetDate.getTime());
    if (diffMs < bestDiffMs) {
      bestDiffMs = diffMs;
      best = point;
    }
  }
  const toleranceMs = toleranceDays * 86_400_000;
  return best && bestDiffMs <= toleranceMs ? best : null;
}

/** Computes % price change over each standard period. dailyHistory (fine-grained, ~3 months) is
 *  used for 1M/3M so those are precise; monthlyHistory (coarse, full ticker lifetime) is used for
 *  the longer periods where daily granularity isn't available anyway. Periods the ticker doesn't
 *  have enough history for come back null instead of an approximated/wrong number. */
export function computeProfitabilityPeriods(
  dailyHistory: HistoricalPricePoint[],
  monthlyHistory: HistoricalPricePoint[],
  currentPrice: number,
  now: Date,
): Record<ProfitabilityPeriod, number | null> {
  const result = {} as Record<ProfitabilityPeriod, number | null>;
  for (const period of Object.keys(PERIOD_MONTHS) as ProfitabilityPeriod[]) {
    const months = PERIOD_MONTHS[period];
    const targetDate = new Date(now);
    targetDate.setMonth(targetDate.getMonth() - months);
    const source = months <= 3 ? dailyHistory : monthlyHistory;
    const tolerance = months <= 3 ? 10 : 45;
    const point = closestPointWithinTolerance(source, targetDate, tolerance);
    result[period] = point && point.close > 0 ? Math.round(((currentPrice - point.close) / point.close) * 1000) / 10 : null;
  }
  return result;
}

/** "Se você tivesse investido R$X há 1 ano, teria R$Y hoje" — the tip banner's number. */
export function computeAmountIfInvested(amount: number, pctChange: number | null): number | null {
  if (pctChange === null) return null;
  return Math.round(amount * (1 + pctChange / 100) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Dividendos por ano + radar de meses
// ---------------------------------------------------------------------------

export interface DividendYearSummary {
  year: number;
  totalPerShare: number;
  /** Dividend yield for the year = totalPerShare / average share price that year. Null when there's
   *  no price data covering that year (e.g. ticker didn't exist yet under this symbol). */
  yieldPercent: number | null;
}

function yearOf(event: DividendEvent): number | null {
  const date = event.paymentDate ?? event.exDate;
  return date ? new Date(date).getFullYear() : null;
}

/** Groups dividend events by calendar year and, when price history is available for that year,
 *  computes the year's dividend yield off the average of that year's monthly closes. */
export function groupDividendsByYear(events: DividendEvent[], monthlyPriceHistory: HistoricalPricePoint[]): DividendYearSummary[] {
  const totals = new Map<number, number>();
  for (const event of events) {
    const year = yearOf(event);
    if (year === null) continue;
    totals.set(year, (totals.get(year) ?? 0) + event.rate);
  }

  const pricesByYear = new Map<number, number[]>();
  for (const point of monthlyPriceHistory) {
    const year = new Date(point.date).getFullYear();
    const arr = pricesByYear.get(year) ?? [];
    arr.push(point.close);
    pricesByYear.set(year, arr);
  }

  return Array.from(totals.entries())
    .map(([year, totalPerShare]) => {
      const prices = pricesByYear.get(year);
      const avgPrice = prices && prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
      return {
        year,
        totalPerShare: Math.round(totalPerShare * 100) / 100,
        yieldPercent: avgPrice && avgPrice > 0 ? Math.round((totalPerShare / avgPrice) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => a.year - b.year);
}

/** Payout ratio = dividendo por ação ÷ lucro por ação, computed from the last FULLY completed
 *  calendar year in dividendsByYear (skips the current year when it's the most recent entry — a
 *  partial year of dividends divided against a full trailing-twelve-months EPS would understate the
 *  ratio, since most of the year's dividends haven't been paid yet). Falls back to whatever single
 *  year is available if that's all there is (e.g. a stock that only started paying this year). Null
 *  with no dividend history yet or no EPS to divide against. Needs no data beyond what this page
 *  already fetches (dividendsByYear + LPA), unlike every other module-sourced indicator. */
export function computePayoutRatio(dividendsByYear: DividendYearSummary[], eps: number | null, currentYear: number): number | null {
  if (eps === null || eps === 0 || dividendsByYear.length === 0) return null;
  const completedYears = dividendsByYear.filter((y) => y.year < currentYear);
  const target = completedYears.length > 0 ? completedYears[completedYears.length - 1] : dividendsByYear[dividendsByYear.length - 1];
  return Math.round((target.totalPerShare / eps) * 1000) / 10;
}

export interface DividendMonthRadarEntry {
  month: number;
  monthlyPaymentCount: number;
}

/** "Radar de dividendo inteligente" — which calendar months this asset has historically paid in,
 *  so the user can anticipate the next payment without re-reading the whole history each time. */
export function computeDividendMonthRadar(events: DividendEvent[]): DividendMonthRadarEntry[] {
  const counts = new Array(12).fill(0);
  for (const event of events) {
    const date = event.paymentDate ?? event.exDate;
    if (!date) continue;
    counts[new Date(date).getMonth()] += 1;
  }
  return counts.map((monthlyPaymentCount, index) => ({ month: index + 1, monthlyPaymentCount }));
}

// ---------------------------------------------------------------------------
// Histórico de payout (lucro líquido x payout% x DY%, ano a ano)
// ---------------------------------------------------------------------------

export interface PayoutYearEntry {
  year: number;
  netIncome: number;
  payoutPercent: number | null;
  dividendYieldPercent: number | null;
}

/** Combines annual net income (from BRAPI's incomeStatementHistory) with the dividends-by-year
 *  summary to build the classic "lucro (barras) x payout% (linha) x DY% (linha)" chart. A year
 *  with net income but no matching dividend data simply gets null payout/DY for that year. */
export function computePayoutHistory(incomeHistory: AnnualIncomeEntry[], dividendsByYear: DividendYearSummary[]): PayoutYearEntry[] {
  const dividendsByYearMap = new Map(dividendsByYear.map((d) => [d.year, d]));
  return incomeHistory
    .map(({ year, netIncome }) => {
      const dividends = dividendsByYearMap.get(year);
      const totalDividendsValue = dividends?.totalPerShare ?? null;
      return {
        year,
        netIncome: Math.round(netIncome * 100) / 100,
        payoutPercent: totalDividendsValue !== null && netIncome > 0 ? Math.round((totalDividendsValue / netIncome) * 1000) / 10 : null,
        dividendYieldPercent: dividends?.yieldPercent ?? null,
      };
    })
    .sort((a, b) => a.year - b.year);
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export type ChecklistStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
}

export interface ChecklistInput {
  /** Net income per fiscal year, oldest first — from incomeStatementHistory. Null when unavailable. */
  annualNetIncome: AnnualIncomeEntry[] | null;
  /** Net income per fiscal quarter, oldest first — from incomeStatementHistoryQuarterly. */
  quarterlyNetIncome: number[] | null;
  /** Dividend yield per year, most recent years — from groupDividendsByYear. */
  dividendYearYields: DividendYearSummary[];
  returnOnEquityPercent: number | null;
  totalLiabilities: number | null;
  totalStockholderEquity: number | null;
  /** Average daily traded volume in BRL (regularMarketVolume × price) — always available from the
   *  plain quote endpoint, unlike everything else on this list. */
  averageDailyVolumeBRL: number | null;
  /** How far back price/dividend history reaches, in years — a proxy for "listed/tradeable for at
   *  least 5 years" when annualNetIncome (the more rigorous signal) isn't available at all. Not the
   *  same as "founded 5+ years ago", but the practical question this check is really after. */
  yearsOfHistoryAvailable: number | null;
  /** Whether the most recent trailing-twelve-months net income was positive — a same-day-snapshot
   *  fallback for "profitable recently" when quarterlyNetIncome (the real 20-quarter series) isn't
   *  available at all. Much weaker than the real check, so it only ever backs the reduced-scope
   *  "profitable nos últimos 12 meses" item, never a genuine 20-quarters claim. */
  recentNetIncomePositive: boolean | null;
}

function unknownOr(status: boolean | null, id: string, label: string): ChecklistItem {
  return { id, label, status: status === null ? "UNKNOWN" : status ? "PASS" : "FAIL" };
}

export function computeChecklist(input: ChecklistInput): ChecklistItem[] {
  const olderThan5Years = input.annualNetIncome
    ? input.annualNetIncome.length >= 5
    : input.yearsOfHistoryAvailable !== null
      ? input.yearsOfHistoryAvailable >= 5
      : null;
  const neverHadLoss = input.annualNetIncome ? input.annualNetIncome.every((y) => y.netIncome > 0) : null;
  const profitableRecentPeriod =
    input.quarterlyNetIncome && input.quarterlyNetIncome.length >= 20
      ? input.quarterlyNetIncome.slice(-20).every((v) => v > 0)
      : input.recentNetIncomePositive;

  const recentYears = input.dividendYearYields.slice(-5);
  const dividendAbove5PctLast5Years =
    recentYears.length >= 5 ? recentYears.every((y) => y.yieldPercent !== null && y.yieldPercent >= 5) : recentYears.length > 0 ? null : null;

  const roeAbove10 = input.returnOnEquityPercent !== null ? input.returnOnEquityPercent > 10 : null;

  const debtBelowEquity =
    input.totalLiabilities !== null && input.totalStockholderEquity !== null ? input.totalLiabilities < input.totalStockholderEquity : null;

  const liquidityAbove2M = input.averageDailyVolumeBRL !== null ? input.averageDailyVolumeBRL >= 2_000_000 : null;

  return [
    unknownOr(olderThan5Years, "older-than-5-years", "Empresa com mais de 5 anos"),
    unknownOr(neverHadLoss, "never-had-loss", "Empresa nunca deu prejuízo *Rever"),
    unknownOr(profitableRecentPeriod, "profitable-recent-period", "Empresa com lucro nos últimos 12 meses"),
    unknownOr(dividendAbove5PctLast5Years, "dividend-above-5pct-5-years", "Empresa pagou +5% de dividendo nos últimos 5 anos"),
    unknownOr(roeAbove10, "roe-above-10", "Empresa possui ROE acima de 10%"),
    unknownOr(debtBelowEquity, "debt-below-equity", "Empresa possui dívida menor que patrimônio"),
    unknownOr(liquidityAbove2M, "liquidity-above-2m", "Empresa possui liquidez diária acima de 2 milhões"),
  ];
}
