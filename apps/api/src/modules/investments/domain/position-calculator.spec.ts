import { calculatePosition } from "./position-calculator";

function d(daysFromEpoch: number): Date {
  return new Date(2024, 0, 1 + daysFromEpoch);
}

describe("calculatePosition", () => {
  it("returns zeroed position with no transactions", () => {
    const result = calculatePosition([]);
    expect(result).toEqual({ quantity: 0, averagePrice: 0, investedAmount: 0, realizedProfit: 0 });
  });

  it("computes average price across two buys at different prices", () => {
    const result = calculatePosition([
      { type: "BUY", quantity: 100, unitPrice: 10, fees: 0, transactionDate: d(0) },
      { type: "BUY", quantity: 100, unitPrice: 20, fees: 0, transactionDate: d(1) },
    ]);
    expect(result.quantity).toBe(200);
    expect(result.averagePrice).toBeCloseTo(15, 6);
    expect(result.investedAmount).toBeCloseTo(3000, 6);
  });

  it("includes fees in the cost basis", () => {
    const result = calculatePosition([{ type: "BUY", quantity: 10, unitPrice: 100, fees: 50, transactionDate: d(0) }]);
    expect(result.averagePrice).toBeCloseTo(105, 6);
  });

  it("keeps the average price unchanged after a partial sell", () => {
    const result = calculatePosition([
      { type: "BUY", quantity: 100, unitPrice: 10, fees: 0, transactionDate: d(0) },
      { type: "SELL", quantity: 40, unitPrice: 15, fees: 0, transactionDate: d(1) },
    ]);
    expect(result.quantity).toBe(60);
    expect(result.averagePrice).toBeCloseTo(10, 6);
    expect(result.realizedProfit).toBeCloseTo((15 - 10) * 40, 6);
  });

  it("resets the average price once the position is fully closed", () => {
    const result = calculatePosition([
      { type: "BUY", quantity: 100, unitPrice: 10, fees: 0, transactionDate: d(0) },
      { type: "SELL", quantity: 100, unitPrice: 15, fees: 0, transactionDate: d(1) },
      { type: "BUY", quantity: 50, unitPrice: 30, fees: 0, transactionDate: d(2) },
    ]);
    expect(result.quantity).toBe(50);
    expect(result.averagePrice).toBeCloseTo(30, 6);
  });

  it("processes out-of-order transactions by transactionDate, not insertion order", () => {
    const result = calculatePosition([
      { type: "SELL", quantity: 40, unitPrice: 15, fees: 0, transactionDate: d(1) },
      { type: "BUY", quantity: 100, unitPrice: 10, fees: 0, transactionDate: d(0) },
    ]);
    expect(result.quantity).toBe(60);
    expect(result.averagePrice).toBeCloseTo(10, 6);
  });

  it("subtracts fees from realized profit on a sell", () => {
    const result = calculatePosition([
      { type: "BUY", quantity: 100, unitPrice: 10, fees: 0, transactionDate: d(0) },
      { type: "SELL", quantity: 100, unitPrice: 15, fees: 20, transactionDate: d(1) },
    ]);
    expect(result.realizedProfit).toBeCloseTo((15 - 10) * 100 - 20, 6);
  });

  it("never lets quantity go negative when overselling", () => {
    const result = calculatePosition([
      { type: "BUY", quantity: 10, unitPrice: 10, fees: 0, transactionDate: d(0) },
      { type: "SELL", quantity: 50, unitPrice: 15, fees: 0, transactionDate: d(1) },
    ]);
    expect(result.quantity).toBe(0);
    expect(result.averagePrice).toBe(0);
  });
});
