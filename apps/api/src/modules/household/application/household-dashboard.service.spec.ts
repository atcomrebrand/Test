import { HouseholdDashboardService } from "./household-dashboard.service";
import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdCardsService } from "./household-cards.service";
import { HouseholdIncomesService } from "./household-incomes.service";
import { HouseholdPresumedSalaryService } from "./household-presumed-salary.service";

function makeBills(byMonth: Record<string, unknown[]> = {}): HouseholdBillsService {
  return {
    findMonth: jest.fn((_userId: string, year: number, month: number) => Promise.resolve(byMonth[`${year}-${month}`] ?? [])),
  } as unknown as HouseholdBillsService;
}

function makeCards(byMonth: Record<string, unknown[]> = {}): HouseholdCardsService {
  return {
    findMonth: jest.fn((_userId: string, year: number, month: number) => Promise.resolve(byMonth[`${year}-${month}`] ?? [])),
  } as unknown as HouseholdCardsService;
}

function makeIncomes(entries: unknown[] = []): HouseholdIncomesService {
  return { findMonth: jest.fn().mockResolvedValue(entries) } as unknown as HouseholdIncomesService;
}

function makePresumedSalary(estimate: { amount: number; isForeignCurrency: boolean; rateUsed: number | null } | null = null): HouseholdPresumedSalaryService {
  return { estimateBrl: jest.fn().mockResolvedValue(estimate) } as unknown as HouseholdPresumedSalaryService;
}

describe("HouseholdDashboardService.month — billsResolvedCount / paidPct treat SKIPPED as resolved", () => {
  it("counts a SKIPPED bill toward billsResolvedCount and paidPct, alongside PAID bills", async () => {
    const bills = makeBills({
      "2026-7": [
        { status: "PAID", amount: 100, reservedAmount: 0, paidAmount: 100, bill: { mandatory: true } },
        { status: "SKIPPED", amount: 50, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } },
        { status: "PENDING", amount: 75, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } },
      ],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.billsPaidCount).toBe(1);
    expect(result.billsResolvedCount).toBe(2);
    expect(result.billsCount).toBe(3);
    expect(result.paidPct).toBeCloseTo(66.7, 1);
  });
});

describe("HouseholdDashboardService.month — skipped bills don't count as money owed", () => {
  it("excludes a SKIPPED bill's amount from totalBills/totalCommitted/totalMandatory/totalOptional", async () => {
    const bills = makeBills({
      "2026-7": [
        { status: "PENDING", amount: 100, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } },
        { status: "SKIPPED", amount: 250, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } },
      ],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.totalBills).toBe(100);
    expect(result.totalCommitted).toBe(100);
    expect(result.totalMandatory).toBe(100);
    expect(result.totalPending).toBe(100);
  });

  it("excludes a SKIPPED bill from the category breakdown", async () => {
    const bills = makeBills({
      "2026-7": [{ status: "SKIPPED", amount: 250, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true, category: { id: "c1", name: "Lazer", color: "#fff" } } }],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.billsByCategory).toEqual([]);
  });

  it("still counts the SKIPPED bill in billsCount/billsSkippedCount (status breakdown unaffected)", async () => {
    const bills = makeBills({ "2026-7": [{ status: "SKIPPED", amount: 250, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } }] });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.billsCount).toBe(1);
    expect(result.billsSkippedCount).toBe(1);
  });

  it("excludes a SKIPPED bill from last month's totalCommitted in previousMonthComparison too", async () => {
    const bills = makeBills({
      "2026-6": [{ status: "SKIPPED", amount: 300, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } }],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.previousMonthComparison.totalCommitted).toBe(0);
  });
});

describe("HouseholdDashboardService.month — allPaid", () => {
  it("is true when every bill is PAID/SKIPPED and every card is paid", async () => {
    const bills = makeBills({ "2026-7": [{ status: "PAID", amount: 100, reservedAmount: 0, paidAmount: 100, bill: { mandatory: true } }] });
    const cards = makeCards({ "2026-7": [{ realAmount: 50, paid: true }] });
    const service = new HouseholdDashboardService(bills, cards, makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.allPaid).toBe(true);
  });

  it("is false for an empty month (nothing to be 'all paid' about)", async () => {
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.allPaid).toBe(false);
  });

  it("is false when a bill is still pending", async () => {
    const bills = makeBills({
      "2026-7": [
        { status: "PAID", amount: 100, reservedAmount: 0, paidAmount: 100, bill: { mandatory: true } },
        { status: "PENDING", amount: 50, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } },
      ],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.allPaid).toBe(false);
  });
});

describe("HouseholdDashboardService.month — foreignIncome", () => {
  it("aggregates only the isForeignCurrency income entries", async () => {
    const incomes = makeIncomes([
      { amount: 5000, isForeignCurrency: true, grossAmountForeign: 1000, exchangeRate: 5 },
      { amount: 2500, isForeignCurrency: true, grossAmountForeign: 500, exchangeRate: 5 },
      { amount: 3000, isForeignCurrency: false, grossAmountForeign: null, exchangeRate: null },
    ]);
    const service = new HouseholdDashboardService(makeBills(), makeCards(), incomes, makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.foreignIncome).toEqual({ count: 2, totalGrossUsd: 1500, totalConvertedBrl: 7500, avgRate: 5 });
  });

  it("returns a zeroed summary with null avgRate when there's no foreign income", async () => {
    const incomes = makeIncomes([{ amount: 3000, isForeignCurrency: false, grossAmountForeign: null, exchangeRate: null }]);
    const service = new HouseholdDashboardService(makeBills(), makeCards(), incomes, makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.foreignIncome).toEqual({ count: 0, totalGrossUsd: 0, totalConvertedBrl: 0, avgRate: null });
  });
});

describe("HouseholdDashboardService.month — savingsRate", () => {
  it("is the free balance as a percentage of total income", async () => {
    const bills = makeBills({ "2026-7": [{ status: "PENDING", amount: 400, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } }] });
    const incomes = makeIncomes([{ amount: 1000, isForeignCurrency: false }]);
    const service = new HouseholdDashboardService(bills, makeCards(), incomes, makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.savingsRate).toBe(60);
  });

  it("is null when there's no income at all this month", async () => {
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.savingsRate).toBeNull();
  });
});

describe("HouseholdDashboardService.month — previousMonthComparison", () => {
  it("compares against last month's totals and computes the delta percentage", async () => {
    const bills = makeBills({
      "2026-7": [{ status: "PENDING", amount: 200, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } }],
      "2026-6": [{ status: "PAID", amount: 100, reservedAmount: 0, paidAmount: 100, bill: { mandatory: true } }],
    });
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 7);

    expect(result.previousMonthComparison).toEqual({
      referenceYear: 2026,
      referenceMonth: 6,
      totalCommitted: 100,
      totalPaid: 100,
      deltaCommittedPct: 100,
    });
  });

  it("rolls back across the year boundary — January compares against last December", async () => {
    const bills = makeBills();
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes(), makePresumedSalary());

    const result = await service.month("user-1", 2026, 1);

    expect(result.previousMonthComparison.referenceYear).toBe(2025);
    expect(result.previousMonthComparison.referenceMonth).toBe(12);
  });
});

describe("HouseholdDashboardService.month — presumed salary fallback", () => {
  it("uses the presumed salary as totalIncome when no income was logged yet this month", async () => {
    const presumedSalary = makePresumedSalary({ amount: 5000, isForeignCurrency: false, rateUsed: null });
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes([]), presumedSalary);

    const result = await service.month("user-1", 2026, 7);

    expect(result.totalIncome).toBe(5000);
    expect(result.presumedSalary).toEqual({ applied: true, amount: 5000, isForeignCurrency: false, rateUsed: null });
  });

  it("live-converts a foreign-currency presumed salary and reports the rate used", async () => {
    const presumedSalary = makePresumedSalary({ amount: 5300, isForeignCurrency: true, rateUsed: 5.3 });
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes([]), presumedSalary);

    const result = await service.month("user-1", 2026, 7);

    expect(result.totalIncome).toBe(5300);
    expect(result.presumedSalary).toEqual({ applied: true, amount: 5300, isForeignCurrency: true, rateUsed: 5.3 });
  });

  it("does not apply the presumed salary once real income has been logged for the month", async () => {
    const presumedSalary = makePresumedSalary({ amount: 5000, isForeignCurrency: false, rateUsed: null });
    const incomes = makeIncomes([{ amount: 3200, isForeignCurrency: false, grossAmountForeign: null, exchangeRate: null }]);
    const service = new HouseholdDashboardService(makeBills(), makeCards(), incomes, presumedSalary);

    const result = await service.month("user-1", 2026, 7);

    expect(result.totalIncome).toBe(3200);
    expect(result.presumedSalary).toEqual({ applied: false, amount: 0, isForeignCurrency: false, rateUsed: null });
    expect(presumedSalary.estimateBrl).not.toHaveBeenCalled();
  });

  it("falls back to zero income when no presumed salary is configured and nothing was logged", async () => {
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes([]), makePresumedSalary(null));

    const result = await service.month("user-1", 2026, 7);

    expect(result.totalIncome).toBe(0);
    expect(result.presumedSalary).toEqual({ applied: false, amount: 0, isForeignCurrency: false, rateUsed: null });
  });
});
