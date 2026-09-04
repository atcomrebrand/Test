import { computeTrailingForecast, generateForecastInsight } from "./spending-forecast";

describe("computeTrailingForecast", () => {
  it("returns null forecast for empty history", () => {
    expect(computeTrailingForecast({ history: [] })).toEqual({ forecast: null, trendPct: null });
  });

  it("averages the trailing window (default size 3)", () => {
    const result = computeTrailingForecast({ history: [100, 200, 300, 400, 500] });
    // last 3: 300, 400, 500 -> avg 400
    expect(result.forecast).toBe(400);
  });

  it("computes trend vs the previous window", () => {
    // window: [400,500,600] avg 500; previous window: [100,200,300] avg 200 -> +150%
    const result = computeTrailingForecast({ history: [100, 200, 300, 400, 500, 600] });
    expect(result.forecast).toBe(500);
    expect(result.trendPct).toBe(150);
  });

  it("returns null trend when there is no previous window", () => {
    const result = computeTrailingForecast({ history: [100, 200] });
    expect(result.trendPct).toBeNull();
  });

  it("respects a custom window size", () => {
    const result = computeTrailingForecast({ history: [10, 20, 30, 40], windowSize: 2 });
    expect(result.forecast).toBe(35);
  });

  it("returns null trend when the previous window average is zero", () => {
    const result = computeTrailingForecast({ history: [0, 0, 0, 100, 200, 300] });
    expect(result.trendPct).toBeNull();
  });
});

describe("generateForecastInsight", () => {
  it("returns null when there is no forecast", () => {
    expect(generateForecastInsight({ label: "gastos", forecast: null, trendPct: null })).toBeNull();
  });

  it("describes stability when trend is small or unknown", () => {
    const text = generateForecastInsight({ label: "gastos com cartão", forecast: 500, trendPct: 0.5 });
    expect(text).toContain("estável");
  });

  it("describes an upward trend", () => {
    const text = generateForecastInsight({ label: "gastos com cartão", forecast: 500, trendPct: 20 });
    expect(text).toContain("alta");
    expect(text).toContain("20%");
  });

  it("describes a downward trend", () => {
    const text = generateForecastInsight({ label: "gastos com cartão", forecast: 500, trendPct: -15 });
    expect(text).toContain("queda");
    expect(text).toContain("15%");
  });
});
