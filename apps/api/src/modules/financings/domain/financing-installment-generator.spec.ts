import { generateFixedInstallments } from "./financing-installment-generator";

describe("generateFixedInstallments", () => {
  it("repeats the exact same amount every month", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 0, 10),
      installmentAmount: 1234.56,
      installmentsCount: 4,
    });

    expect(result.map((i) => i.amount)).toEqual([1234.56, 1234.56, 1234.56, 1234.56]);
  });

  it("numbers installments sequentially from 1", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 0, 10),
      installmentAmount: 500,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.number)).toEqual([1, 2, 3]);
  });

  it("advances one month at a time, rolling over year boundaries", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 10, 15), // Nov 15
      installmentAmount: 800,
      installmentsCount: 4,
    });

    expect(result.map((i) => [i.dueDate.getFullYear(), i.dueDate.getMonth()])).toEqual([
      [2026, 10],
      [2026, 11],
      [2027, 0],
      [2027, 1],
    ]);
  });

  it("clamps the due day for shorter months instead of overflowing", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 0, 31), // Jan 31
      installmentAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.dueDate.getDate())).toEqual([31, 28, 31]); // Jan 31, Feb 28 (2026 not leap), Mar 31
  });

  it("handles a 35-year house financing term without drifting", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 0, 5),
      installmentAmount: 2100,
      installmentsCount: 420,
    });

    expect(result).toHaveLength(420);
    expect(result[419].dueDate.getFullYear()).toBe(2060);
    expect(result[419].dueDate.getMonth()).toBe(11); // December
  });

  it("rejects a non-positive installment amount", () => {
    expect(() =>
      generateFixedInstallments({ nextDueDate: new Date(), installmentAmount: 0, installmentsCount: 12 }),
    ).toThrow();
  });

  it("rejects fewer than 1 installment", () => {
    expect(() =>
      generateFixedInstallments({ nextDueDate: new Date(), installmentAmount: 100, installmentsCount: 0 }),
    ).toThrow();
  });

  it("marks every installment as PENDING and unpaid when paidInstallmentsCount is omitted", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 0, 10),
      installmentAmount: 500,
      installmentsCount: 3,
    });

    expect(result.every((i) => i.status === "PENDING")).toBe(true);
    expect(result.every((i) => i.paidAt === null && i.paidAmount === null)).toBe(true);
  });

  it("marks the first N installments as PAID and anchors the schedule on nextDueDate for an in-progress financing", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 5, 10), // June 10th — due date of installment #4 (3 already paid)
      installmentAmount: 900,
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
    expect(result[0].paidAmount).toBe(900);
    expect(result[3].paidAt).toBeNull();
    expect(result[3].paidAmount).toBeNull();
  });

  it("clamps paid installments' back-dated due days for shorter months too", () => {
    const result = generateFixedInstallments({
      nextDueDate: new Date(2026, 2, 31), // March 31st — installment #3
      installmentAmount: 100,
      installmentsCount: 5,
      paidInstallmentsCount: 2,
    });

    expect(result.map((i) => i.dueDate.getDate())).toEqual([31, 28, 31, 30, 31]); // Jan 31, Feb 28, Mar 31, Apr 30, May 31
  });

  it("rejects paidInstallmentsCount equal to or greater than the total", () => {
    expect(() =>
      generateFixedInstallments({
        nextDueDate: new Date(),
        installmentAmount: 100,
        installmentsCount: 3,
        paidInstallmentsCount: 3,
      }),
    ).toThrow();
  });

  it("rejects a negative paidInstallmentsCount", () => {
    expect(() =>
      generateFixedInstallments({
        nextDueDate: new Date(),
        installmentAmount: 100,
        installmentsCount: 3,
        paidInstallmentsCount: -1,
      }),
    ).toThrow();
  });
});
