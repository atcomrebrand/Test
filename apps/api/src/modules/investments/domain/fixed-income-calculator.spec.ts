import { calculateFixedIncome } from "./fixed-income-calculator";

function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

describe("calculateFixedIncome", () => {
  const applicationDate = new Date("2024-01-01T12:00:00Z");

  it("computes gross value with compound interest for PREFIXADO", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 12,
    });

    expect(result.grossValue).toBeCloseTo(11200, 0);
    expect(result.grossYield).toBeCloseTo(1200, 0);
  });

  it("applies POS_FIXADO_CDI using cdiPercent of the current CDI annual rate", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 110,
      cdiAnnualRate: 10,
    });

    // effective annual = 10 * 1.10 = 11%
    expect(result.grossValue).toBeCloseTo(11100, 0);
  });

  it("compounds IPCA and the fixed spread separately for IPCA_MAIS", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "TESOURO",
      indexer: "IPCA_MAIS",
      fixedRatePercent: 6,
      ipcaAnnualRate: 4,
    });

    expect(result.grossValue).toBeCloseTo(10000 * 1.04 * 1.06, 0);
  });

  describe("IR regressive bracket", () => {
    const params = { principalAmount: 10000, applicationDate, type: "CDB" as const, indexer: "PREFIXADO" as const, fixedRatePercent: 12 };

    it("applies 22.5% up to 180 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 180) });
      expect(result.irRate).toBe(22.5);
    });

    it("applies 20% from 181 to 360 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 181) });
      expect(result.irRate).toBe(20);
      const upper = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 360) });
      expect(upper.irRate).toBe(20);
    });

    it("applies 17.5% from 361 to 720 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 361) });
      expect(result.irRate).toBe(17.5);
      const upper = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 720) });
      expect(upper.irRate).toBe(17.5);
    });

    it("applies 15% above 720 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 721) });
      expect(result.irRate).toBe(15);
    });
  });

  describe("IOF regressive table (redemptions under 30 days)", () => {
    const params = { principalAmount: 10000, applicationDate, type: "CDB" as const, indexer: "PREFIXADO" as const, fixedRatePercent: 12 };

    it("retains 96% of the yield as IOF on day 1", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 1) });
      expect(result.iofRate).toBe(96);
    });

    it("retains 3% of the yield as IOF on day 29", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 29) });
      expect(result.iofRate).toBe(3);
    });

    it("charges no IOF from day 30 onward", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 30) });
      expect(result.iofRate).toBe(0);
    });

    it("deducts IOF from the gross yield before applying IR", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 1) });
      const expectedIofAmount = result.grossYield * 0.96;
      expect(result.iofAmount).toBeCloseTo(expectedIofAmount, 6);
      const yieldAfterIof = result.grossYield - expectedIofAmount;
      expect(result.irAmount).toBeCloseTo(yieldAfterIof * 0.225, 6);
    });
  });

  describe("LCI/LCA IR exemption", () => {
    it("never charges IR on LCI regardless of holding period", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 900),
        type: "LCI",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(0);
      expect(result.irAmount).toBe(0);
    });

    it("never charges IR on LCA regardless of holding period", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 50),
        type: "LCA",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(0);
    });

    it("still charges IR normally on a CDB with the same terms", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 900),
        type: "CDB",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(15);
      expect(result.irAmount).toBeGreaterThan(0);
    });
  });

  it("always yields netValue <= grossValue and netValue = principal + netYield", () => {
    const result = calculateFixedIncome({
      principalAmount: 5000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 200),
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 15,
    });
    expect(result.netValue).toBeLessThanOrEqual(result.grossValue);
    expect(result.netValue).toBeCloseTo(5000 + result.netYield, 6);
  });

  it("returns zero yield with no growth on the application date itself", () => {
    const result = calculateFixedIncome({
      principalAmount: 5000,
      applicationDate,
      asOfDate: applicationDate,
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 15,
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.grossYield).toBeCloseTo(0, 6);
    expect(result.netValue).toBeCloseTo(5000, 6);
  });
});
