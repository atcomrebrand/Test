import { computeFinancingPayoffDebt, FinancingForPayoffDebt } from "./financing-payoff-debt";

function financing(overrides: Partial<FinancingForPayoffDebt> = {}): FinancingForPayoffDebt {
  return { active: true, payoffAmount: null, installments: [], ...overrides };
}

describe("computeFinancingPayoffDebt", () => {
  it("uses the payoff quote when it's set, ignoring installment totals", () => {
    const result = computeFinancingPayoffDebt([
      financing({ payoffAmount: 18000, installments: [{ status: "PENDING", amount: 600 }, { status: "PENDING", amount: 600 }] }),
    ]);
    expect(result).toBe(18000);
  });

  it("falls back to summing PENDING/LATE installments when there's no payoff quote", () => {
    const result = computeFinancingPayoffDebt([
      financing({
        payoffAmount: null,
        installments: [
          { status: "PENDING", amount: 600 },
          { status: "LATE", amount: 600 },
          { status: "PAID", amount: 600 },
          { status: "CANCELLED", amount: 600 },
        ],
      }),
    ]);
    expect(result).toBe(1200);
  });

  it("excludes inactive financings entirely", () => {
    const result = computeFinancingPayoffDebt([
      financing({ active: false, payoffAmount: 5000 }),
      financing({ active: true, payoffAmount: 3000 }),
    ]);
    expect(result).toBe(3000);
  });

  it("sums across multiple financings mixing quoted and unquoted", () => {
    const result = computeFinancingPayoffDebt([
      financing({ payoffAmount: 10000 }),
      financing({ payoffAmount: null, installments: [{ status: "PENDING", amount: 500 }] }),
    ]);
    expect(result).toBe(10500);
  });

  it("returns 0 for an empty list", () => {
    expect(computeFinancingPayoffDebt([])).toBe(0);
  });
});
