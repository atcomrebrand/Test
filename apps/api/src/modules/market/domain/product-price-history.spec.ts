import { ProductPricePoint, summarizeProductPrices } from "./product-price-history";

function point(purchaseDate: string, unitPrice: number, quantity = 1, storeName = "Mercado A"): ProductPricePoint {
  return { purchaseDate, storeName, unitPrice, quantity, totalPrice: Math.round(unitPrice * quantity * 100) / 100 };
}

describe("summarizeProductPrices", () => {
  it("returns null when the product was never bought", () => {
    expect(summarizeProductPrices([])).toBeNull();
  });

  it("reports first/last by date regardless of the order the points arrive in", () => {
    const summary = summarizeProductPrices([point("2026-05-01", 30), point("2026-01-01", 25), point("2026-03-01", 28)])!;
    expect(summary.firstPrice).toBe(25);
    expect(summary.firstDate).toBe("2026-01-01");
    expect(summary.lastPrice).toBe(30);
    expect(summary.lastDate).toBe("2026-05-01");
  });

  it("computes the price change from first to last purchase", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-06-01", 25)])!;
    expect(summary.changePercent).toBeCloseTo(25, 10);
  });

  it("reports a price drop as a negative change", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-06-01", 15)])!;
    expect(summary.changePercent).toBeCloseTo(-25, 10);
  });

  it("has no change to report for a product bought only once", () => {
    expect(summarizeProductPrices([point("2026-01-01", 20)])!.changePercent).toBeNull();
  });

  it("weights the average by quantity, so a big cheap buy outweighs a small expensive one", () => {
    // 5kg at 4,00 (=20,00) and 1kg at 10,00 (=10,00): 30,00 over 6kg = 5,00/kg.
    const summary = summarizeProductPrices([point("2026-01-01", 4, 5), point("2026-02-01", 10, 1)])!;
    expect(summary.averagePrice).toBeCloseTo(5, 10);
    // A naive mean of the unit prices would have said 7,00 — materially wrong.
    expect(summary.averagePrice).not.toBeCloseTo(7, 1);
  });

  it("accumulates spend, quantity and purchase count", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 4, 5), point("2026-02-01", 10, 1)])!;
    expect(summary.timesBought).toBe(2);
    expect(summary.totalSpent).toBeCloseTo(30, 10);
    expect(summary.totalQuantity).toBeCloseTo(6, 10);
  });

  it("tracks the cheapest and most expensive prices seen", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-02-01", 12), point("2026-03-01", 25)])!;
    expect(summary.minPrice).toBe(12);
    expect(summary.maxPrice).toBe(25);
  });

  it("names the store with the cheapest price on record", () => {
    const summary = summarizeProductPrices([
      point("2026-01-01", 20, 1, "Mercado Caro"),
      point("2026-02-01", 12, 1, "Mercado Barato"),
      point("2026-03-01", 25, 1, "Mercado Caro"),
    ])!;
    expect(summary.cheapestStore).toBe("Mercado Barato");
    expect(summary.cheapestStorePrice).toBe(12);
  });

  it("treats a zero first price as no comparison rather than an infinite increase", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 0), point("2026-06-01", 10)])!;
    expect(summary.changePercent).toBeNull();
  });

  it("does not divide by zero when every purchase had zero quantity", () => {
    const summary = summarizeProductPrices([{ purchaseDate: "2026-01-01", storeName: "A", unitPrice: 0, quantity: 0, totalPrice: 0 }])!;
    expect(summary.averagePrice).toBe(0);
  });
});
