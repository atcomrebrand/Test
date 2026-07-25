import { HouseholdDashboardService } from "./household-dashboard.service";
import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdCardsService } from "./household-cards.service";
import { HouseholdIncomesService } from "./household-incomes.service";

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

describe("HouseholdDashboardService.month — allPaid", () => {
  it("is true when every bill is PAID/SKIPPED and every card is paid", async () => {
    const bills = makeBills({ "2026-7": [{ status: "PAID", amount: 100, reservedAmount: 0, paidAmount: 100, bill: { mandatory: true } }] });
    const cards = makeCards({ "2026-7": [{ realAmount: 50, paid: true }] });
    const service = new HouseholdDashboardService(bills, cards, makeIncomes());

    const result = await service.month("user-1", 2026, 7);

    expect(result.allPaid).toBe(true);
  });

  it("is false for an empty month (nothing to be 'all paid' about)", async () => {
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes());

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
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes());

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
    const service = new HouseholdDashboardService(makeBills(), makeCards(), incomes);

    const result = await service.month("user-1", 2026, 7);

    expect(result.foreignIncome).toEqual({ count: 2, totalGrossUsd: 1500, totalConvertedBrl: 7500, avgRate: 5 });
  });

  it("returns a zeroed summary with null avgRate when there's no foreign income", async () => {
    const incomes = makeIncomes([{ amount: 3000, isForeignCurrency: false, grossAmountForeign: null, exchangeRate: null }]);
    const service = new HouseholdDashboardService(makeBills(), makeCards(), incomes);

    const result = await service.month("user-1", 2026, 7);

    expect(result.foreignIncome).toEqual({ count: 0, totalGrossUsd: 0, totalConvertedBrl: 0, avgRate: null });
  });
});

describe("HouseholdDashboardService.month — savingsRate", () => {
  it("is the free balance as a percentage of total income", async () => {
    const bills = makeBills({ "2026-7": [{ status: "PENDING", amount: 400, reservedAmount: 0, paidAmount: 0, bill: { mandatory: true } }] });
    const incomes = makeIncomes([{ amount: 1000, isForeignCurrency: false }]);
    const service = new HouseholdDashboardService(bills, makeCards(), incomes);

    const result = await service.month("user-1", 2026, 7);

    expect(result.savingsRate).toBe(60);
  });

  it("is null when there's no income at all this month", async () => {
    const service = new HouseholdDashboardService(makeBills(), makeCards(), makeIncomes());

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
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes());

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
    const service = new HouseholdDashboardService(bills, makeCards(), makeIncomes());

    const result = await service.month("user-1", 2026, 1);

    expect(result.previousMonthComparison.referenceYear).toBe(2025);
    expect(result.previousMonthComparison.referenceMonth).toBe(12);
  });
});
