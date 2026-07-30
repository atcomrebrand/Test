import { calculateNetWorth } from "./net-worth-calculator";

describe("calculateNetWorth", () => {
  it("subtracts debts from assets", () => {
    const result = calculateNetWorth({ investedAssets: 50000, totalDebt: 12000 });
    expect(result.assets).toBe(50000);
    expect(result.debts).toBe(12000);
    expect(result.netWorth).toBe(38000);
  });

  it("allows a negative net worth when debts exceed assets", () => {
    const result = calculateNetWorth({ investedAssets: 1000, totalDebt: 5000 });
    expect(result.netWorth).toBe(-4000);
  });

  it("computes debtToAssetPct rounded to one decimal", () => {
    const result = calculateNetWorth({ investedAssets: 3000, totalDebt: 1000 });
    expect(result.debtToAssetPct).toBeCloseTo(33.3, 1);
  });

  it("returns null debtToAssetPct when there are no assets", () => {
    const result = calculateNetWorth({ investedAssets: 0, totalDebt: 500 });
    expect(result.debtToAssetPct).toBeNull();
  });

  it("clamps negative inputs to zero instead of flipping the sign", () => {
    const result = calculateNetWorth({ investedAssets: -100, totalDebt: -50 });
    expect(result.assets).toBe(0);
    expect(result.debts).toBe(0);
    expect(result.netWorth).toBe(0);
  });
});
