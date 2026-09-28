import { findDuplicateAutoIncomes } from "./dividend-duplicate-repair";

const MARKER = "Calculado automaticamente (histórico BRAPI)";

describe("findDuplicateAutoIncomes", () => {
  it("flags the ex-date-recorded twin of an event, keeping the row on the real payment date (the production bug shape)", () => {
    // Old Yahoo-sourced sync recorded the income under the ex-date; the Fundamentus-sourced sync
    // later recorded the same event under the real payment date, months apart.
    const incomes = [
      { id: "old", amount: 15, paymentDate: "2026-03-01", notes: MARKER },
      { id: "new", amount: 15, paymentDate: "2026-07-15", notes: MARKER },
    ];
    const events = [{ estimatedAmount: 15, exDate: "2026-03-01", paymentDate: "2026-07-15" }];

    expect(findDuplicateAutoIncomes(incomes, events)).toEqual(["old"]);
  });

  it("never flags incomes without the auto-sync notes marker (manual or B3-imported rows)", () => {
    const incomes = [
      { id: "manual", amount: 15, paymentDate: "2026-03-01", notes: null },
      { id: "imported", amount: 15, paymentDate: "2026-07-15", notes: "Importado da B3" },
      { id: "auto", amount: 15, paymentDate: "2026-07-15", notes: MARKER },
    ];
    const events = [{ estimatedAmount: 15, exDate: "2026-03-01", paymentDate: "2026-07-15" }];

    expect(findDuplicateAutoIncomes(incomes, events)).toEqual([]);
  });

  it("keeps distinct events separate: consecutive monthly FII payouts of similar value are not merged", () => {
    const incomes = [
      { id: "jan", amount: 10, paymentDate: "2026-01-14", notes: MARKER },
      { id: "fev", amount: 10.5, paymentDate: "2026-02-14", notes: MARKER },
    ];
    const events = [
      { estimatedAmount: 10, exDate: "2026-01-31", paymentDate: "2026-01-14" },
      { estimatedAmount: 10.5, exDate: "2026-02-28", paymentDate: "2026-02-14" },
    ];

    expect(findDuplicateAutoIncomes(incomes, events)).toEqual([]);
  });

  it("attributes each income to its closest event when one event's payment date is near another's ex-date", () => {
    // A's payment lands in April, B's data-com is also April — each row must stay with its own
    // event instead of being deleted as the other's duplicate.
    const incomes = [
      { id: "a-payment", amount: 12, paymentDate: "2026-04-10", notes: MARKER },
      { id: "b-ex", amount: 12.5, paymentDate: "2026-04-12", notes: MARKER },
    ];
    const events = [
      { estimatedAmount: 12, exDate: "2026-01-10", paymentDate: "2026-04-10" },
      { estimatedAmount: 12.5, exDate: "2026-04-12", paymentDate: "2026-07-10" },
    ];

    expect(findDuplicateAutoIncomes(incomes, events)).toEqual([]);
  });

  it("does not delete anything when there is no event evidence (all sources down)", () => {
    const incomes = [
      { id: "a", amount: 15, paymentDate: "2026-03-01", notes: MARKER },
      { id: "b", amount: 15, paymentDate: "2026-03-02", notes: MARKER },
    ];

    expect(findDuplicateAutoIncomes(incomes, [])).toEqual([]);
  });

  it("does not delete an auto income that matches no event within tolerance", () => {
    const incomes = [
      { id: "orphan", amount: 99, paymentDate: "2020-01-01", notes: MARKER },
      { id: "old", amount: 15, paymentDate: "2026-03-01", notes: MARKER },
      { id: "new", amount: 15, paymentDate: "2026-07-15", notes: MARKER },
    ];
    const events = [{ estimatedAmount: 15, exDate: "2026-03-01", paymentDate: "2026-07-15" }];

    expect(findDuplicateAutoIncomes(incomes, events)).toEqual(["old"]);
  });

  it("with three rows on the same event, keeps only the closest to the payment date", () => {
    const incomes = [
      { id: "ex-dated", amount: 15, paymentDate: "2026-03-01", notes: MARKER },
      { id: "correct", amount: 15.1, paymentDate: "2026-07-15", notes: MARKER },
      { id: "near-payment", amount: 14.9, paymentDate: "2026-07-18", notes: MARKER },
    ];
    const events = [{ estimatedAmount: 15, exDate: "2026-03-01", paymentDate: "2026-07-15" }];

    const result = findDuplicateAutoIncomes(incomes, events);
    expect(result).toHaveLength(2);
    expect(result).toContain("ex-dated");
    expect(result).toContain("near-payment");
    expect(result).not.toContain("correct");
  });
});
