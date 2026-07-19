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

  it("supports a due day of 29 on a card that closes on the 29th", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 15), // July 15th
      closingDay: 29,
      dueDay: 29,
      totalAmount: 100,
      installmentsCount: 1,
    });

    expect(result[0].dueDate.getDate()).toBe(29);
    expect(result[0].dueDate.getMonth()).toBe(6); // July (before closing day, current invoice)
  });

  it("clamps a due day of 31 to the last real day of a shorter month (February)", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 0, 15), // Jan 15th, closes before day 31 so lands on January invoice
      closingDay: 31,
      dueDay: 31,
      totalAmount: 100,
      installmentsCount: 2,
    });

    expect(result[0].dueDate.getMonth()).toBe(0); // January has 31 days
    expect(result[0].dueDate.getDate()).toBe(31);
    expect(result[1].dueDate.getMonth()).toBe(1); // February 2026 has 28 days
    expect(result[1].dueDate.getDate()).toBe(28);
  });
});

describe("generateRecurringOccurrences", () => {
  it("charges the full amount every month, never splitting it", () => {
    const result = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 0, 15),
      monthlyAmount: 44.9,
      count: 4,
    });

    expect(result.map((o) => o.amount)).toEqual([44.9, 44.9, 44.9, 44.9]);
  });

  it("anchors the first occurrence directly on nextPaymentDate, with no closing-day math", () => {
    const result = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 6, 25), // July 25th — the user's actual next charge date
      monthlyAmount: 20,
      count: 1,
    });

    expect(result[0].referenceMonth).toBe(7);
    expect(result[0].dueDate.getDate()).toBe(25);
  });

  it("numbers consecutive months starting from 1 by default", () => {
    const result = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 0, 15),
      monthlyAmount: 10,
      count: 3,
    });

    expect(result.map((o) => o.number)).toEqual([1, 2, 3]);
    expect(result.map((o) => o.referenceMonth)).toEqual([1, 2, 3]);
    expect(result.map((o) => o.dueDate.getDate())).toEqual([15, 15, 15]);
  });

  it("tops up an existing subscription seamlessly using startNumber", () => {
    const firstBatch = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 0, 15),
      monthlyAmount: 10,
      count: 3,
    });
    const topUp = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 0, 15),
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
      nextPaymentDate: new Date(2026, 10, 20),
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

  it("clamps the charge day for shorter months", () => {
    const result = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 0, 31), // Jan 31st
      monthlyAmount: 9.9,
      count: 3,
    });

    expect(result.map((o) => o.dueDate.getDate())).toEqual([31, 28, 31]); // Jan 31, Feb 28 (2026 not leap), Mar 31
  });
});
