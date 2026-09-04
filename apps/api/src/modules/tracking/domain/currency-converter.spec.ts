import { convertToBRL } from "./currency-converter";

describe("convertToBRL", () => {
  it("passes BRL amounts through unchanged, ignoring the rate", () => {
    expect(convertToBRL(1000, "BRL", null)).toBe(1000);
    expect(convertToBRL(1000, "BRL", 5.5)).toBe(1000);
  });

  it("converts USD using the given rate", () => {
    expect(convertToBRL(1000, "USD", 5.5)).toBe(5500);
  });

  it("rounds to 2 decimal places", () => {
    expect(convertToBRL(100, "USD", 5.4321)).toBe(543.21);
  });

  it("returns null for USD when no rate is available", () => {
    expect(convertToBRL(1000, "USD", null)).toBeNull();
  });
});
