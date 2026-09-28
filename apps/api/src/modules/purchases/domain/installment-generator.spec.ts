import { generateInstallments, generateInstallmentsInProgress, generateRecurringOccurrences } from "./installment-generator";

describe("generateInstallments", () => {
  it("puts a purchase made on/before the closing day into the current invoice", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 8), // July 8th
      closingDay: 10,
      dueDay: 17,
      installmentAmount: 1200,
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
      installmentAmount: 1200,
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
      installmentAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => [i.referenceYear, i.referenceMonth])).toEqual([
      [2027, 1],
      [2027, 2],
      [2027, 3],
    ]);
  });

  it("charges the exact same fixed amount every installment, with no splitting or remainder", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 0, 1),
      closingDay: 10,
      dueDay: 5,
      installmentAmount: 33.33,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.amount)).toEqual([33.33, 33.33, 33.33]);
  });

  it("generates a single installment for cash purchases", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 3, 1),
      closingDay: 10,
      dueDay: 5,
      installmentAmount: 250,
      installmentsCount: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(250);
  });

  it("sets the due date to the card's due day in the reference month", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 8),
      closingDay: 10,
      dueDay: 22,
      installmentAmount: 100,
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
      installmentAmount: 100,
      installmentsCount: 1,
    });

    expect(result[0].dueDate.getDate()).toBe(29);
    expect(result[0].dueDate.getMonth()).toBe(6); // July (before closing day, current invoice)
  });

  it("rolls the due date into the following month when the due day is before the closing day", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 5, 15), // June 15th
      closingDay: 28,
      dueDay: 5,
      installmentAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.referenceMonth)).toEqual([6, 7, 8]); // still named by closing month
    expect(result.map((i) => [i.dueDate.getMonth(), i.dueDate.getDate()])).toEqual([
      [6, 5], // July 5th — due after the June 28th closing, not before it
      [7, 5], // August 5th
      [8, 5], // September 5th
    ]);
  });

  it("rolls the due date's year forward when the crossover lands in January", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 11, 10), // Dec 10th
      closingDay: 28,
      dueDay: 5,
      installmentAmount: 100,
      installmentsCount: 1,
    });

    expect(result[0].referenceMonth).toBe(12);
    expect(result[0].referenceYear).toBe(2026);
    expect(result[0].dueDate.getFullYear()).toBe(2027);
    expect(result[0].dueDate.getMonth()).toBe(0); // January
    expect(result[0].dueDate.getDate()).toBe(5);
  });

  it("keeps the due date in the same month as the reference when the due day is on/after the closing day", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 6, 8),
      closingDay: 10,
      dueDay: 17,
      installmentAmount: 100,
      installmentsCount: 1,
    });

    expect(result[0].dueDate.getMonth()).toBe(6); // July — same as referenceMonth
    expect(result[0].dueDate.getDate()).toBe(17);
  });

  it("clamps a due day of 31 to the last real day of a shorter month (February)", () => {
    const result = generateInstallments({
      purchaseDate: new Date(2026, 0, 15), // Jan 15th, closes before day 31 so lands on January invoice
      closingDay: 31,
      dueDay: 31,
      installmentAmount: 100,
      installmentsCount: 2,
    });

    expect(result[0].dueDate.getMonth()).toBe(0); // January has 31 days
    expect(result[0].dueDate.getDate()).toBe(31);
    expect(result[1].dueDate.getMonth()).toBe(1); // February 2026 has 28 days
    expect(result[1].dueDate.getDate()).toBe(28);
  });
});

describe("generateInstallmentsInProgress", () => {
  it("marks the first N parcelas as PAID and anchors the schedule on nextDueDate", () => {
    const result = generateInstallmentsInProgress({
      nextDueDate: new Date(2026, 5, 10), // June 10th — due date of parcela #4 (3 already paid)
      installmentAmount: 150,
      installmentsCount: 6,
      paidInstallmentsCount: 3,
    });

    expect(result.map((i) => i.status)).toEqual(["PAID", "PAID", "PAID", "PENDING", "PENDING", "PENDING"]);
    expect(result.map((i) => [i.dueDate.getFullYear(), i.dueDate.getMonth(), i.dueDate.getDate()])).toEqual([
      [2026, 2, 10], // March
      [2026, 3, 10], // April
      [2026, 4, 10], // May
      [2026, 5, 10], // June — matches nextDueDate
      [2026, 6, 10], // July
      [2026, 7, 10], // August
    ]);
    expect(result[0].paidAt).toEqual(result[0].dueDate);
    expect(result[0].paidAmount).toBe(150);
    expect(result[3].paidAt).toBeNull();
    expect(result[3].paidAmount).toBeNull();
  });

  it("supports a brand-new plan logged as in-progress with 0 paid (equivalent to a fresh start)", () => {
    const result = generateInstallmentsInProgress({
      nextDueDate: new Date(2026, 0, 15),
      installmentAmount: 80,
      installmentsCount: 3,
      paidInstallmentsCount: 0,
    });

    expect(result.every((i) => i.status === "PENDING")).toBe(true);
    expect(result.map((i) => i.dueDate.getDate())).toEqual([15, 15, 15]);
  });

  it("clamps back-dated due days for shorter months", () => {
    const result = generateInstallmentsInProgress({
      nextDueDate: new Date(2026, 2, 31), // March 31st — parcela #3
      installmentAmount: 100,
      installmentsCount: 5,
      paidInstallmentsCount: 2,
    });

    expect(result.map((i) => i.dueDate.getDate())).toEqual([31, 28, 31, 30, 31]); // Jan 31, Feb 28, Mar 31, Apr 30, May 31
  });

  it("rejects paidInstallmentsCount equal to or greater than the total", () => {
    expect(() =>
      generateInstallmentsInProgress({
        nextDueDate: new Date(),
        installmentAmount: 100,
        installmentsCount: 3,
        paidInstallmentsCount: 3,
      }),
    ).toThrow();
  });

  it("rejects a negative paidInstallmentsCount", () => {
    expect(() =>
      generateInstallmentsInProgress({
        nextDueDate: new Date(),
        installmentAmount: 100,
        installmentsCount: 3,
        paidInstallmentsCount: -1,
      }),
    ).toThrow();
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

  it("advances a year at a time for ANNUAL billing (e.g. a domain renewal)", () => {
    const result = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 2, 10), // March 10th
      monthlyAmount: 60,
      count: 3,
      billingCycle: "ANNUAL",
    });

    expect(result.map((o) => [o.referenceYear, o.referenceMonth, o.dueDate.getDate()])).toEqual([
      [2026, 3, 10],
      [2027, 3, 10],
      [2028, 3, 10],
    ]);
  });

  it("tops up an ANNUAL subscription seamlessly using startNumber", () => {
    const topUp = generateRecurringOccurrences({
      nextPaymentDate: new Date(2026, 2, 10),
      monthlyAmount: 60,
      startNumber: 3,
      count: 1,
      billingCycle: "ANNUAL",
    });

    expect(topUp[0].referenceYear).toBe(2028);
  });
});
