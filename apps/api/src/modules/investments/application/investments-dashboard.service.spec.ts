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
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", assetId: { not: null }, asset: { deletedAt: null } } }),
    );
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

describe("InvestmentsDashboardService.summary — deleted assets stop counting everywhere", () => {
  it("excludes a soft-deleted asset's buy transactions from aportesDoMes", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } }));
    prisma.investmentTransaction.findMany = findMany;
    const service = new InvestmentsDashboardService(prisma, makeAssets(), makeFixedIncomes(), makeCashAccounts());

    await service.summary("user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "BUY", asset: { deletedAt: null } }) }),
    );
  });

  it("excludes a soft-deleted asset's transactions from evolucaoPatrimonial", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } }));
    prisma.investmentTransaction.findMany = findMany;
    const service = new InvestmentsDashboardService(prisma, makeAssets(), makeFixedIncomes(), makeCashAccounts());

    await service.summary("user-1");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", asset: { deletedAt: null } } }));
  });
});

describe("InvestmentsDashboardService.summary — ganhosPorCategoria and redeemed CDB profit", () => {
  it("keeps a redeemed fixed income's frozen netYield in lucroLiquido, not just active ones", async () => {
    const redeemed = {
      id: "fi-1",
      institution: "Banco X",
      type: "CDB",
      principalAmount: "1000",
      maturityDate: new Date("2026-01-01"),
      redeemedAt: new Date("2026-03-01"),
      calculation: { netValue: 1050, netYield: 50, netProfitabilityPercent: 5 },
    };
    const fixedIncomes = { findAll: jest.fn().mockResolvedValue([redeemed]) } as unknown as FixedIncomesService;
    const service = new InvestmentsDashboardService(
      makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })),
      makeAssets(),
      fixedIncomes,
      makeCashAccounts(),
    );

    const result = await service.summary("user-1");

    // A redeemed CDB no longer counts toward current capital (valorInvestido/valorAtual), since
    // the money isn't sitting there anymore — but its already-earned profit should never vanish.
    expect(result.cards.lucroLiquido).toBe(50);
    expect(result.cards.valorInvestido).toBe(0);
  });

  it("breaks total gains down by category, combining active + redeemed fixed incomes under RENDA_FIXA", async () => {
    const stock = {
      class: "STOCK",
      ticker: "PETR4",
      profit: 100,
      position: { realizedProfit: 20, investedAmount: 500 },
      currentValue: 600,
      dividendsReceived: 0,
    };
    const crypto = {
      class: "CRYPTO",
      ticker: "BTC",
      profit: -10,
      position: { realizedProfit: 0, investedAmount: 200 },
      currentValue: 190,
      dividendsReceived: 0,
    };
    const assets = { findAll: jest.fn().mockResolvedValue([stock, crypto]) } as unknown as AssetsService;
    const redeemedCdb = {
      institution: "Banco X",
      type: "CDB",
      principalAmount: "1000",
      maturityDate: new Date("2026-01-01"),
      redeemedAt: new Date("2026-03-01"),
      calculation: { netValue: 1050, netYield: 50, netProfitabilityPercent: 5 },
    };
    const fixedIncomes = { findAll: jest.fn().mockResolvedValue([redeemedCdb]) } as unknown as FixedIncomesService;
    const service = new InvestmentsDashboardService(
      makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })),
      assets,
      fixedIncomes,
      makeCashAccounts(),
    );

    const result = await service.summary("user-1");

    expect(result.ganhosPorCategoria).toEqual(
      expect.arrayContaining([
        { category: "STOCK", total: 120 },
        { category: "CRYPTO", total: -10 },
        { category: "RENDA_FIXA", total: 50 },
      ]),
    );
  });

  it("folds dividendsReceived into the per-asset gain, so a dividend-heavy stock doesn't look like it earned less than it did", async () => {
    const stock = {
      class: "STOCK",
      ticker: "BBAS3",
      profit: 10,
      position: { realizedProfit: 0, investedAmount: 500 },
      currentValue: 510,
      dividendsReceived: 200,
    };
    const assets = { findAll: jest.fn().mockResolvedValue([stock]) } as unknown as AssetsService;
    const service = new InvestmentsDashboardService(
      makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })),
      assets,
      makeFixedIncomes(),
      makeCashAccounts(),
    );

    const result = await service.summary("user-1");

    expect(result.ganhosPorCategoria).toEqual(expect.arrayContaining([{ category: "STOCK", total: 210 }]));
  });

  it("omits RENDA_FIXA from ganhosPorCategoria when there's no fixed income at all, active or redeemed", async () => {
    const service = new InvestmentsDashboardService(
      makePrisma(jest.fn().mockResolvedValue({ _sum: { amount: 0 } })),
      makeAssets(),
      makeFixedIncomes(),
      makeCashAccounts(),
    );

    const result = await service.summary("user-1");

    expect(result.ganhosPorCategoria.find((c) => c.category === "RENDA_FIXA")).toBeUndefined();
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
