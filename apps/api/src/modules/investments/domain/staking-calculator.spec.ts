import { calculateStakingYield } from "./staking-calculator";

function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

describe("calculateStakingYield", () => {
  const sinceDate = new Date("2024-01-01T12:00:00Z");

  it("returns zero yield on the same day", () => {
    const result = calculateStakingYield({ investedAmount: 1000, apyPercent: 10, sinceDate, asOfDate: sinceDate });
    expect(result.daysHeld).toBe(0);
    expect(result.estimatedYield).toBeCloseTo(0, 6);
    expect(result.estimatedValue).toBeCloseTo(1000, 6);
  });

  it("compounds to roughly the APY after one year", () => {
    const result = calculateStakingYield({ investedAmount: 1000, apyPercent: 10, sinceDate, asOfDate: daysAfter(sinceDate, 365) });
    expect(result.estimatedValue).toBeCloseTo(1100, 0);
    expect(result.estimatedYield).toBeCloseTo(100, 0);
  });

  it("scales linearly with invested amount", () => {
    const small = calculateStakingYield({ investedAmount: 1000, apyPercent: 8, sinceDate, asOfDate: daysAfter(sinceDate, 180) });
    const large = calculateStakingYield({ investedAmount: 10000, apyPercent: 8, sinceDate, asOfDate: daysAfter(sinceDate, 180) });
    expect(large.estimatedYield).toBeCloseTo(small.estimatedYield * 10, 4);
  });

  it("handles a 0% APY as no yield", () => {
    const result = calculateStakingYield({ investedAmount: 5000, apyPercent: 0, sinceDate, asOfDate: daysAfter(sinceDate, 200) });
    expect(result.estimatedYield).toBeCloseTo(0, 6);
  });
});
