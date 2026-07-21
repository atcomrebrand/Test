import { InvestmentsDashboardService } from "./investments-dashboard.service";
import { AssetsService } from "./assets.service";
import { FixedIncomesService } from "./fixed-incomes.service";
import { CashAccountRepository } from "../domain/cash-account.repository";

function makePrisma(aggregate: jest.Mock) {
  return {
    investmentIncome: { aggregate },
    investmentAuditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    investmentTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    investmentFixedIncome: { aggregate: jest.fn().mockResolvedValue({ _sum: { principalAmount: 0 } }), findMany: jest.fn().mockResolvedValue([]) },
    investmentContribution: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
  } as any;
}

function makeAssets(): AssetsService {
  return { findAll: jest.fn().mockResolvedValue([]) } as unknown as AssetsService;
}

function makeFixedIncomes(): FixedIncomesService {
  return { findAll: jest.fn().mockResolvedValue([]) } as unknown as FixedIncomesService;
}

function makeCashAccounts(): CashAccountRepository {
  return { sumBalancesByUser: jest.fn().mockResolvedValue(0) } as unknown as CashAccountRepository;
}

describe("InvestmentsDashboardService.summary — dividendosRecebidos card", () => {
  it("sums ALL asset-linked income (any type), not just DIVIDENDO/JCP/RENDIMENTO — so Yahoo/FII payouts filed as OUTRO by the automatic sync still count", async () => {
    const aggregate = jest.fn().mockImplementation(({ where }) => {
      if (where.assetId) return Promise.resolve({ _sum: { amount: 507.12 } });
      if (where.type) return Promise.resolve({ _sum: { amount: 0 } });
      return Promise.resolve({ _sum: { amount: 0 } });
    });
    const service = new InvestmentsDashboardService(makePrisma(aggregate), makeAssets(), makeFixedIncomes(), makeCashAccounts());

    const result = await service.summary("user-1");

    expect(result.cards.dividendosRecebidos).toBe(507.12);
    expect(aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", assetId: { not: null } } }));
  });

  it("keeps jurosRecebidos scoped to the JUROS type (fixed-income interest), independent of the assetId-based dividend sum", async () => {
    const aggregate = jest.fn().mockImplementation(({ where }) => {
      if (where.assetId) return Promise.resolve({ _sum: { amount: 100 } });
      if (where.type?.in?.includes("JUROS")) return Promise.resolve({ _sum: { amount: 42 } });
      return Promise.resolve({ _sum: { amount: 0 } });
    });
    const service = new InvestmentsDashboardService(makePrisma(aggregate), makeAssets(), makeFixedIncomes(), makeCashAccounts());

    const result = await service.summary("user-1");

    expect(result.cards.dividendosRecebidos).toBe(100);
    expect(result.cards.jurosRecebidos).toBe(42);
  });
});

describe("InvestmentsDashboardService.summary — refresh button forces fresh prices", () => {
  it("defaults to forceRefresh=false when not passed", async () => {
    const assets = makeAssets();
    const service = new InvestmentsDashboardService(makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })), assets, makeFixedIncomes(), makeCashAccounts());

    await service.summary("user-1");

    expect(assets.findAll).toHaveBeenCalledWith("user-1", undefined, false);
  });

  it("threads forceRefresh=true through to AssetsService.findAll, bypassing the price cache TTL", async () => {
    const assets = makeAssets();
    const service = new InvestmentsDashboardService(makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })), assets, makeFixedIncomes(), makeCashAccounts());

    await service.summary("user-1", true);

    expect(assets.findAll).toHaveBeenCalledWith("user-1", undefined, true);
  });
});
