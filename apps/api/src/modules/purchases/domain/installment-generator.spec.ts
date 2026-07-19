import { generateInstallments, generateRecurringOccurrences } from "./installment-generator";

describe("generateInstallments", () => {
  it("puts a purchase made on/before the closing day into the current invoice", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 8), // July 8th
      closingDay: 10,
      dueDay: 17,
      totalAmount: 1200,
      installmentsCount: 1,
    });

    expect(result[0].referenceMonth).toBe(7);
    expect(result[0].referenceYear).toBe(2026);
  });

  it("rolls a purchase made after the closing day into next month's invoice", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 12), // July 12th
      closingDay: 10,
      dueDay: 17,
      totalAmount: 1200,
      installmentsCount: 1,
    });

    expect(result[0].referenceMonth).toBe(8);
    expect(result[0].referenceYear).toBe(2026);
  });

  it("rolls over the year boundary", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 11, 15), // Dec 15th
      closingDay: 10,
      dueDay: 5,
      totalAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => [i.referenceYear, i.referenceMonth])).toEqual([
      [2027, 1],
      [2027, 2],
      [2027, 3],
    ]);
  });

  it("splits amounts evenly and puts the rounding remainder on the last installment", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 5,
      totalAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.amount)).toEqual([33.33, 33.33, 33.34]);
    const sum = result.reduce((acc, i) => acc + i.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });

  it("subtracts the down payment before dividing installments", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 5,
      totalAmount: 1000,
      installmentsCount: 2,
      downPayment: 200,
    });

    expect(result.map((i) => i.amount)).toEqual([400, 400]);
  });

  it("generates a single installment for cash purchases", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 3, 1),
      closingDay: 10,
      dueDay: 5,
      totalAmount: 250,
      installmentsCount: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(250);
  });

  it("rejects a down payment greater than or equal to the total", () => {
    expect(() =>
      generateInstallments({
        purchaseDate: new Date(),
        closingDay: 10,
        dueDay: 5,
        totalAmount: 100,
        installmentsCount: 2,
        downPayment: 100,
      }),
    ).toThrow();
  });

  it("sets the due date to the card's due day in the reference month", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 8),
      closingDay: 10,
      dueDay: 22,
      totalAmount: 100,
      installmentsCount: 1,
    });

    expect(result[0].dueDate.getDate()).toBe(22);
    expect(result[0].dueDate.getMonth()).toBe(6);
  });
});

describe("generateRecurringOccurrences", () => {
  it("charges the full amount every month, never splitting it", () => {
    const result = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 0, 5),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 44.9,
      count: 4,
    });

    expect(result.map((o) => o.amount)).toEqual([44.9, 44.9, 44.9, 44.9]);
  });

  it("applies the same closing-day rule as parceled purchases for the first occurrence", () => {
    const before = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 6, 8),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 20,
      count: 1,
    });
    const after = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 6, 12),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 20,
      count: 1,
    });

    expect(before[0].referenceMonth).toBe(7);
    expect(after[0].referenceMonth).toBe(8);
  });

  it("numbers consecutive months starting from 1 by default", () => {
    const result = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 10,
      count: 3,
    });

    expect(result.map((o) => o.number)).toEqual([1, 2, 3]);
    expect(result.map((o) => o.referenceMonth)).toEqual([1, 2, 3]);
  });

  it("tops up an existing subscription seamlessly using startNumber", () => {
    const firstBatch = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 10,
      count: 3,
    });
    const topUp = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 15,
      monthlyAmount: 10,
      startNumber: 4,
      count: 2,
    });

    expect(topUp.map((o) => o.number)).toEqual([4, 5]);
    expect(topUp.map((o) => [o.referenceYear, o.referenceMonth])).toEqual([
      [2026, 4],
      [2026, 5],
    ]);
    expect(firstBatch.at(-1)?.referenceMonth).toBe(3);
  });

  it("rolls the due date across the year boundary", () => {
    const result = generateRecurringOccurrences({
      purchaseDate: new Date(2026, 10, 5),
      closingDay: 10,
      dueDay: 20,
      monthlyAmount: 15,
      count: 4,
    });

    expect(result.map((o) => [o.referenceYear, o.referenceMonth])).toEqual([
      [2026, 11],
      [2026, 12],
      [2027, 1],
      [2027, 2],
    ]);
  });
});
