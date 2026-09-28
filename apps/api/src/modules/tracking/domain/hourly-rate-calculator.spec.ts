import { computeHourlyRateBreakdown } from "./hourly-rate-calculator";

describe("computeHourlyRateBreakdown", () => {
  it("matches the spec's own worked example (142h, R$8700 -> ~R$61.27/h)", () => {
    const result = computeHourlyRateBreakdown({
      fixedJobsRevenue: 6000,
      fixedJobsSeconds: 142 * 3600,
      freelanceRevenue: 2300,
      freelanceHours: 0,
      otherIncome: 400,
    });

    expect(result.totalRevenue).toBe(8700);
    expect(result.totalHours).toBe(142);
    expect(result.averageHourlyRate).toBeCloseTo(61.27, 1);
  });

  it("adds freelance hours into total hours worked", () => {
    const result = computeHourlyRateBreakdown({
      fixedJobsRevenue: 1000,
      fixedJobsSeconds: 10 * 3600,
      freelanceRevenue: 500,
      freelanceHours: 5,
      otherIncome: 0,
    });

    expect(result.totalHours).toBe(15);
    expect(result.totalRevenue).toBe(1500);
  });

  it("never lets otherIncome affect total hours", () => {
    const result = computeHourlyRateBreakdown({
      fixedJobsRevenue: 0,
      fixedJobsSeconds: 0,
      freelanceRevenue: 0,
      freelanceHours: 0,
      otherIncome: 1000,
    });

    expect(result.totalHours).toBe(0);
    expect(result.totalRevenue).toBe(1000);
    expect(result.averageHourlyRate).toBeNull();
  });

  it("returns null averageHourlyRate when no hours were worked, even with revenue", () => {
    const result = computeHourlyRateBreakdown({
      fixedJobsRevenue: 500,
      fixedJobsSeconds: 0,
      freelanceRevenue: 0,
      freelanceHours: 0,
      otherIncome: 0,
    });

    expect(result.averageHourlyRate).toBeNull();
  });

  it("computes a 'somente trabalhos fixos' breakdown when freelance/other are zeroed out", () => {
    const result = computeHourlyRateBreakdown({
      fixedJobsRevenue: 3000,
      fixedJobsSeconds: 60 * 3600,
      freelanceRevenue: 0,
      freelanceHours: 0,
      otherIncome: 0,
    });

    expect(result.averageHourlyRate).toBe(50);
  });
});
