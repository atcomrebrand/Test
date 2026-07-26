import {
  computeGrahamFairPrice,
  computeBazinCeiling,
  computeProfitabilityPeriods,
  computeAmountIfInvested,
  groupDividendsByYear,
  computeDividendMonthRadar,
  computePayoutHistory,
  computePayoutRatio,
  computeChecklist,
} from "./asset-analysis";
import { HistoricalPricePoint, DividendEvent } from "./market-data.provider";

function dividend(paymentDate: string, rate: number): DividendEvent {
  return { ticker: "TEST3", type: "DIVIDENDO", rate, exDate: paymentDate, paymentDate, relatedTo: null };
}

describe("computeGrahamFairPrice", () => {
  it("computes sqrt(22.5 * LPA * VPA) and the upside vs current price", () => {
    // sqrt(22.5 * 2 * 10) = sqrt(450) ≈ 21.21
    const result = computeGrahamFairPrice(15, 2, 10);
    expect(result?.fairPrice).toBeCloseTo(21.21, 1);
    expect(result?.upsidePercent).toBeCloseTo(41.4, 0);
  });

  it("returns null when earnings per share is null or non-positive", () => {
    expect(computeGrahamFairPrice(15, null, 10)).toBeNull();
    expect(computeGrahamFairPrice(15, -1, 10)).toBeNull();
    expect(computeGrahamFairPrice(15, 0, 10)).toBeNull();
  });

  it("returns null when book value per share is null or non-positive", () => {
    expect(computeGrahamFairPrice(15, 2, null)).toBeNull();
    expect(computeGrahamFairPrice(15, 2, -5)).toBeNull();
  });
});

describe("computeBazinCeiling", () => {
  it("divides the average annual dividend by the target yield (default 6%)", () => {
    const result = computeBazinCeiling(20, 1.2);
    expect(result?.ceilingPrice).toBeCloseTo(20, 2);
  });

  it("respects a custom target yield", () => {
    const result = computeBazinCeiling(20, 1.2, 10);
    expect(result?.ceilingPrice).toBeCloseTo(12, 2);
  });

  it("returns null when there's no dividend history to base the ceiling on", () => {
    expect(computeBazinCeiling(20, null)).toBeNull();
    expect(computeBazinCeiling(20, 0)).toBeNull();
  });
});

describe("computeProfitabilityPeriods", () => {
  const now = new Date("2026-07-25T12:00:00Z");

  function daily(): HistoricalPricePoint[] {
    return [
      { date: "2026-04-25", close: 80 },
      { date: "2026-06-25", close: 90 },
      { date: "2026-07-25", close: 100 },
    ];
  }

  function monthly(): HistoricalPricePoint[] {
    return [
      { date: "2016-07-20", close: 25 },
      { date: "2021-07-20", close: 50 },
      { date: "2024-07-20", close: 75 },
      { date: "2025-07-20", close: 90 },
      { date: "2026-07-20", close: 100 },
    ];
  }

  it("computes 1M and 3M from the daily series", () => {
    const result = computeProfitabilityPeriods(daily(), monthly(), 100, now);
    expect(result["1M"]).toBeCloseTo(11.1, 0); // 90 -> 100
    expect(result["3M"]).toBeCloseTo(25, 0); // 80 -> 100
  });

  it("computes 1A/2A/5A/10A from the monthly series", () => {
    const result = computeProfitabilityPeriods(daily(), monthly(), 100, now);
    expect(result["1A"]).toBeCloseTo(11.1, 0); // 90 (2025-07-20) -> 100
    expect(result["2A"]).toBeCloseTo(33.3, 0); // 75 (2024-07-20) -> 100
    expect(result["5A"]).toBeCloseTo(100, 0); // 50 (2021-07-20) -> 100
    expect(result["10A"]).toBeCloseTo(300, 0); // 25 (2016-07-20) -> 100
  });

  it("returns null for a period with no history point within tolerance (ticker too young)", () => {
    const shortMonthly: HistoricalPricePoint[] = [
      { date: "2025-07-20", close: 90 },
      { date: "2026-07-20", close: 100 },
    ];
    const result = computeProfitabilityPeriods(daily(), shortMonthly, 100, now);
    expect(result["10A"]).toBeNull();
    expect(result["5A"]).toBeNull();
    expect(result["1A"]).not.toBeNull();
  });
});

describe("computeAmountIfInvested", () => {
  it("applies the percent change to the amount", () => {
    expect(computeAmountIfInvested(100, 25)).toBeCloseTo(125, 2);
    expect(computeAmountIfInvested(100, -10)).toBeCloseTo(90, 2);
  });

  it("returns null when the percent change itself is unknown", () => {
    expect(computeAmountIfInvested(100, null)).toBeNull();
  });
});

describe("groupDividendsByYear", () => {
  it("sums dividend rates per calendar year", () => {
    const events = [dividend("2024-03-01", 1.5), dividend("2024-09-01", 1.0), dividend("2025-03-01", 2.0)];
    const result = groupDividendsByYear(events, []);
    expect(result).toEqual([
      { year: 2024, totalPerShare: 2.5, yieldPercent: null },
      { year: 2025, totalPerShare: 2, yieldPercent: null },
    ]);
  });

  it("computes yield percent from the year's average monthly close when price history covers it", () => {
    const events = [dividend("2024-06-01", 2)];
    const monthlyHistory: HistoricalPricePoint[] = [
      { date: "2024-01-15", close: 40 },
      { date: "2024-07-15", close: 60 },
    ];
    const result = groupDividendsByYear(events, monthlyHistory);
    // avg price 2024 = 50, dividend 2, yield = 4%
    expect(result[0].yieldPercent).toBeCloseTo(4, 1);
  });

  it("sorts results chronologically", () => {
    const events = [dividend("2026-01-01", 1), dividend("2020-01-01", 1), dividend("2023-01-01", 1)];
    const result = groupDividendsByYear(events, []);
    expect(result.map((r) => r.year)).toEqual([2020, 2023, 2026]);
  });
});

describe("computeDividendMonthRadar", () => {
  it("counts how many times each calendar month has paid across the history", () => {
    const events = [dividend("2023-03-15", 1), dividend("2024-03-20", 1), dividend("2024-09-10", 1)];
    const result = computeDividendMonthRadar(events);
    expect(result[2].month).toBe(3); // March = index 2
    expect(result[2].monthlyPaymentCount).toBe(2);
    expect(result[8].month).toBe(9); // September = index 8
    expect(result[8].monthlyPaymentCount).toBe(1);
    expect(result[0].monthlyPaymentCount).toBe(0); // January never paid
    expect(result).toHaveLength(12);
  });
});

describe("computePayoutHistory", () => {
  it("pairs each year's net income with its payout% and DY% from dividends", () => {
    const incomeHistory = [
      { year: 2023, netIncome: 1000 },
      { year: 2024, netIncome: 2000 },
    ];
    const dividendsByYear = [
      { year: 2023, totalPerShare: 500, yieldPercent: 5 },
      { year: 2024, totalPerShare: 400, yieldPercent: 4 },
    ];
    const result = computePayoutHistory(incomeHistory, dividendsByYear);
    expect(result).toEqual([
      { year: 2023, netIncome: 1000, payoutPercent: 50, dividendYieldPercent: 5 },
      { year: 2024, netIncome: 2000, payoutPercent: 20, dividendYieldPercent: 4 },
    ]);
  });

  it("leaves payout/DY null for a year with income but no matching dividend data", () => {
    const result = computePayoutHistory([{ year: 2023, netIncome: 1000 }], []);
    expect(result[0].payoutPercent).toBeNull();
    expect(result[0].dividendYieldPercent).toBeNull();
  });
});

describe("computePayoutRatio", () => {
  it("divides the last FULLY completed year's dividend per share by EPS", () => {
    const dividendsByYear = [
      { year: 2023, totalPerShare: 2, yieldPercent: 5 },
      { year: 2024, totalPerShare: 3, yieldPercent: 6 },
      { year: 2025, totalPerShare: 1.5, yieldPercent: 2 },
    ];
    expect(computePayoutRatio(dividendsByYear, 5, 2026)).toBeCloseTo(30);
  });

  it("skips the current (partial) year when it's the most recent entry", () => {
    const dividendsByYear = [
      { year: 2025, totalPerShare: 3, yieldPercent: 6 },
      { year: 2026, totalPerShare: 0.5, yieldPercent: 1 },
    ];
    expect(computePayoutRatio(dividendsByYear, 5, 2026)).toBeCloseTo(60);
  });

  it("falls back to the only year available when it's also the current year", () => {
    const dividendsByYear = [{ year: 2026, totalPerShare: 1, yieldPercent: 2 }];
    expect(computePayoutRatio(dividendsByYear, 5, 2026)).toBeCloseTo(20);
  });

  it("returns null with no dividend history, no EPS, or EPS of zero", () => {
    expect(computePayoutRatio([], 5, 2026)).toBeNull();
    expect(computePayoutRatio([{ year: 2025, totalPerShare: 2, yieldPercent: 5 }], null, 2026)).toBeNull();
    expect(computePayoutRatio([{ year: 2025, totalPerShare: 2, yieldPercent: 5 }], 0, 2026)).toBeNull();
  });
});

describe("computeChecklist", () => {
  function fullPassInput() {
    return {
      annualNetIncome: [
        { year: 2020, netIncome: 100 },
        { year: 2021, netIncome: 110 },
        { year: 2022, netIncome: 120 },
        { year: 2023, netIncome: 130 },
        { year: 2024, netIncome: 140 },
      ],
      quarterlyNetIncome: Array.from({ length: 20 }, () => 30),
      dividendYearYields: [
        { year: 2020, totalPerShare: 5, yieldPercent: 6 },
        { year: 2021, totalPerShare: 5, yieldPercent: 6 },
        { year: 2022, totalPerShare: 5, yieldPercent: 6 },
        { year: 2023, totalPerShare: 5, yieldPercent: 6 },
        { year: 2024, totalPerShare: 5, yieldPercent: 6 },
      ],
      returnOnEquityPercent: 15,
      totalLiabilities: 500,
      totalStockholderEquity: 1000,
      averageDailyVolumeBRL: 5_000_000,
    };
  }

  it("passes every check when all inputs clear their bar", () => {
    const result = computeChecklist(fullPassInput());
    expect(result.every((item) => item.status === "PASS")).toBe(true);
    expect(result).toHaveLength(7);
  });

  it("fails the loss-free check when any year had a loss", () => {
    const input = fullPassInput();
    input.annualNetIncome[2] = { year: 2022, netIncome: -50 };
    const result = computeChecklist(input);
    expect(result.find((i) => i.id === "never-had-loss")?.status).toBe("FAIL");
  });

  it("fails the quarterly-profit check when a recent quarter had a loss", () => {
    const input = fullPassInput();
    input.quarterlyNetIncome![19] = -10;
    const result = computeChecklist(input);
    expect(result.find((i) => i.id === "profitable-20-quarters")?.status).toBe("FAIL");
  });

  it("fails ROE/debt/liquidity checks when below their thresholds", () => {
    const input = fullPassInput();
    input.returnOnEquityPercent = 5;
    input.totalLiabilities = 2000;
    input.averageDailyVolumeBRL = 500_000;
    const result = computeChecklist(input);
    expect(result.find((i) => i.id === "roe-above-10")?.status).toBe("FAIL");
    expect(result.find((i) => i.id === "debt-below-equity")?.status).toBe("FAIL");
    expect(result.find((i) => i.id === "liquidity-above-2m")?.status).toBe("FAIL");
  });

  it("marks a check UNKNOWN instead of failing it when the underlying data is missing", () => {
    const result = computeChecklist({
      annualNetIncome: null,
      quarterlyNetIncome: null,
      dividendYearYields: [],
      returnOnEquityPercent: null,
      totalLiabilities: null,
      totalStockholderEquity: null,
      averageDailyVolumeBRL: null,
    });
    expect(result.every((item) => item.status === "UNKNOWN")).toBe(true);
  });

  it("always resolves the liquidity check when volume data exists, independent of the rest", () => {
    const result = computeChecklist({
      annualNetIncome: null,
      quarterlyNetIncome: null,
      dividendYearYields: [],
      returnOnEquityPercent: null,
      totalLiabilities: null,
      totalStockholderEquity: null,
      averageDailyVolumeBRL: 3_000_000,
    });
    expect(result.find((i) => i.id === "liquidity-above-2m")?.status).toBe("PASS");
  });
});
