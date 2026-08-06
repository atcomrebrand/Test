import { summarizeSpending } from "./spending-summary";

describe("summarizeSpending", () => {
  it("returns an empty summary rather than dividing by zero when nothing was bought", () => {
    const summary = summarizeSpending([]);
    expect(summary).toEqual({
      totalSpent: 0,
      totalTax: 0,
      taxSharePercent: null,
      purchaseCount: 0,
      purchasesWithTax: 0,
      byMonth: [],
    });
  });

  it("adds up spending and tax across purchases", () => {
    const summary = summarizeSpending([
      { purchaseDate: "2026-08-05", totalAmount: 1450.47, taxAmount: 232.08 },
      { purchaseDate: "2026-08-19", totalAmount: 300.0, taxAmount: 48.0 },
    ]);
    expect(summary.totalSpent).toBe(1750.47);
    expect(summary.totalTax).toBe(280.08);
    expect(summary.purchaseCount).toBe(2);
    expect(summary.purchasesWithTax).toBe(2);
  });

  it("measures the tax rate over the purchases that disclosed tax, not over everything spent", () => {
    // Half the spend has no tax figure at all. Dividing by the full R$2.000 would report 5% and
    // silently understate the burden; the purchase that did disclose was taxed at 10%.
    const summary = summarizeSpending([
      { purchaseDate: "2026-08-05", totalAmount: 1000, taxAmount: 100 },
      { purchaseDate: "2026-08-06", totalAmount: 1000, taxAmount: null },
    ]);
    expect(summary.totalTax).toBe(100);
    expect(summary.taxSharePercent).toBe(10);
    expect(summary.purchaseCount).toBe(2);
    expect(summary.purchasesWithTax).toBe(1);
  });

  it("still totals the spending of purchases that carry no tax figure", () => {
    const summary = summarizeSpending([{ purchaseDate: "2026-08-05", totalAmount: 250, taxAmount: null }]);
    expect(summary.totalSpent).toBe(250);
    expect(summary.totalTax).toBe(0);
    expect(summary.taxSharePercent).toBeNull();
  });

  it("groups by month, oldest first, without inventing months that had no purchases", () => {
    const summary = summarizeSpending([
      { purchaseDate: "2026-08-05", totalAmount: 100, taxAmount: 10 },
      { purchaseDate: "2026-06-30", totalAmount: 200, taxAmount: null },
      { purchaseDate: "2026-08-20", totalAmount: 50, taxAmount: 5 },
    ]);
    expect(summary.byMonth.map((m) => m.month)).toEqual(["2026-06", "2026-08"]);
    expect(summary.byMonth[1]).toEqual({ month: "2026-08", totalSpent: 150, totalTax: 15, purchaseCount: 2, purchasesWithTax: 2 });
    expect(summary.byMonth[0].purchasesWithTax).toBe(0);
  });

  it("rounds accumulated cents instead of letting float drift leak into the total", () => {
    const summary = summarizeSpending([
      { purchaseDate: "2026-08-05", totalAmount: 0.1, taxAmount: 0.1 },
      { purchaseDate: "2026-08-06", totalAmount: 0.2, taxAmount: 0.2 },
    ]);
    expect(summary.totalSpent).toBe(0.3);
    expect(summary.totalTax).toBe(0.3);
    expect(summary.byMonth[0].totalSpent).toBe(0.3);
  });
});
