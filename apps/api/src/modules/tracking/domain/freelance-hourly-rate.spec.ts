import { computeFreelanceHourlyRate } from "./freelance-hourly-rate";

describe("computeFreelanceHourlyRate", () => {
  it("divides the total agreed value by the total hours worked so far", () => {
    const rate = computeFreelanceHourlyRate({ totalAgreedValueBRL: 800, totalNetSeconds: 10 * 3600 });
    expect(rate).toBe(80);
  });

  it("returns null when no hours have been logged yet", () => {
    expect(computeFreelanceHourlyRate({ totalAgreedValueBRL: 800, totalNetSeconds: 0 })).toBeNull();
  });

  it("rounds to 2 decimal places", () => {
    const rate = computeFreelanceHourlyRate({ totalAgreedValueBRL: 100, totalNetSeconds: 3 * 3600 });
    expect(rate).toBe(33.33);
  });

  it("recomputes to a lower rate as more hours accumulate against the same total", () => {
    const earlyRate = computeFreelanceHourlyRate({ totalAgreedValueBRL: 800, totalNetSeconds: 5 * 3600 });
    const laterRate = computeFreelanceHourlyRate({ totalAgreedValueBRL: 800, totalNetSeconds: 20 * 3600 });
    expect(earlyRate).toBeGreaterThan(laterRate!);
  });
});
