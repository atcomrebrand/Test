import { generateFixedInstallments } from "./financing-installment-generator";

describe("generateFixedInstallments", () => {
  it("repeats the exact same amount every month", () => {
    const result = generateFixedInstallments({
      firstDueDate: new Date(2026, 0, 10),
      installmentAmount: 1234.56,
      installmentsCount: 4,
    });

    expect(result.map((i) => i.amount)).toEqual([1234.56, 1234.56, 1234.56, 1234.56]);
  });

  it("numbers installments sequentially from 1", () => {
    const result = generateFixedInstallments({
      firstDueDate: new Date(2026, 0, 10),
      installmentAmount: 500,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.number)).toEqual([1, 2, 3]);
  });

  it("advances one month at a time, rolling over year boundaries", () => {
    const result = generateFixedInstallments({
      firstDueDate: new Date(2026, 10, 15), // Nov 15
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
      firstDueDate: new Date(2026, 0, 31), // Jan 31
      installmentAmount: 100,
      installmentsCount: 3,
    });

    expect(result.map((i) => i.dueDate.getDate())).toEqual([31, 28, 31]); // Jan 31, Feb 28 (2026 not leap), Mar 31
  });

  it("handles a 35-year house financing term without drifting", () => {
    const result = generateFixedInstallments({
      firstDueDate: new Date(2026, 0, 5),
      installmentAmount: 2100,
      installmentsCount: 420,
    });

    expect(result).toHaveLength(420);
    expect(result[419].dueDate.getFullYear()).toBe(2060);
    expect(result[419].dueDate.getMonth()).toBe(11); // December
  });

  it("rejects a non-positive installment amount", () => {
    expect(() =>
      generateFixedInstallments({ firstDueDate: new Date(), installmentAmount: 0, installmentsCount: 12 }),
    ).toThrow();
  });

  it("rejects fewer than 1 installment", () => {
    expect(() =>
      generateFixedInstallments({ firstDueDate: new Date(), installmentAmount: 100, installmentsCount: 0 }),
    ).toThrow();
  });
});
