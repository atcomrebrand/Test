import { B3ImportService } from "./b3-import.service";
import { AssetRepository } from "../domain/asset.repository";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

function makeAssetRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    findAllByUser: jest.fn(),
    findById: jest.fn(),
    findByUserAndTicker: jest.fn().mockResolvedValue(null),
    findByIdWithTransactions: jest.fn(),
    create: jest.fn().mockImplementation(async (data) => ({ id: `asset-${data.ticker}`, ...data })),
    update: jest.fn(),
    softDelete: jest.fn(),
    addTransaction: jest.fn().mockResolvedValue({}),
    listTransactions: jest.fn(),
    addIncome: jest.fn().mockResolvedValue({}),
    listIncomes: jest.fn(),
    sumIncomesByUser: jest.fn(),
    listAllTransactionsByUser: jest.fn().mockResolvedValue([]),
    listAllIncomesByUser: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as AssetRepository;
}

function makeDividendsCache(events: Record<string, unknown[]> = {}): DividendsCacheService {
  return {
    get: jest.fn().mockImplementation(async (ticker: string) => events[ticker] ?? []),
  } as unknown as DividendsCacheService;
}

describe("B3ImportService.preview", () => {
  it("dedupes transactions/incomes already present in the database (same ticker/type/qty/price/date)", async () => {
    const existingTx = {
      type: "BUY",
      quantity: 2 as any,
      unitPrice: 20.17 as any,
      fees: 0 as any,
      transactionDate: new Date("2026-07-03"),
      asset: { ticker: "BBAS3F", class: "STOCK" },
    };
    const existingIncome = {
      type: "DIVIDENDO",
      amount: 8.57 as any,
      paymentDate: new Date("2026-07-01"),
      asset: { ticker: "LOGG3", class: "STOCK" },
    };
    const repo = makeAssetRepo({
      listAllTransactionsByUser: jest.fn().mockResolvedValue([existingTx]),
      listAllIncomesByUser: jest.fn().mockResolvedValue([existingIncome]),
    });
    const service = new B3ImportService(repo, makeDividendsCache());

    const negociacao = [{ dataNegocio: "03/07/2026", tipoMovimentacao: "Compra", mercado: "Mercado Fracionário", codigoNegociacao: "BBAS3F", quantidade: 2, preco: 20.17, valor: 40.34 }];
    const movimentacao = [{ data: "01/07/2026", movimentacao: "Dividendo", produto: "LOGG3 - LOG COMMERCIAL PROPERTIES", quantidade: 3, precoUnitario: 2.86, valorOperacao: 8.57 }];

    const result = await service.preview("user-1", negociacao, movimentacao);

    expect(result.transactions).toHaveLength(0);
    expect(result.incomes).toHaveLength(0);
    expect(result.duplicateTransactionsSkipped).toBe(1);
    expect(result.duplicateIncomesSkipped).toBe(1);
  });

  it("keeps a new transaction that differs from an existing one only by date", async () => {
    const existingTx = {
      type: "BUY",
      quantity: 2 as any,
      unitPrice: 20.17 as any,
      fees: 0 as any,
      transactionDate: new Date("2026-01-01"), // different date -> not a duplicate
      asset: { ticker: "BBAS3F", class: "STOCK" },
    };
    const repo = makeAssetRepo({ listAllTransactionsByUser: jest.fn().mockResolvedValue([existingTx]) });
    const service = new B3ImportService(repo, makeDividendsCache());

    const negociacao = [{ dataNegocio: "03/07/2026", tipoMovimentacao: "Compra", mercado: "Mercado Fracionário", codigoNegociacao: "BBAS3F", quantidade: 2, preco: 20.17, valor: 40.34 }];
    const result = await service.preview("user-1", negociacao, []);

    expect(result.transactions).toHaveLength(1);
    expect(result.duplicateTransactionsSkipped).toBe(0);
  });

  it("suggests a BRAPI dividend not present in the statement, sized to the position held at the ex-date", async () => {
    const repo = makeAssetRepo();
    const dividendsCache = makeDividendsCache({
      PETR4: [{ ticker: "PETR4", type: "DIVIDENDO", rate: 1.5, exDate: "2026-06-15", paymentDate: "2026-07-01", relatedTo: "2T2026" }],
    });
    const service = new B3ImportService(repo, dividendsCache);

    const negociacao = [{ dataNegocio: "01/06/2026", tipoMovimentacao: "Compra", mercado: "Mercado à Vista", codigoNegociacao: "PETR4", quantidade: 10, preco: 30, valor: 300 }];
    const result = await service.preview("user-1", negociacao, []);

    expect(result.suggestedIncomes).toHaveLength(1);
    expect(result.suggestedIncomes[0]).toMatchObject({ ticker: "PETR4", amount: 15, quantityHeld: 10, exDate: "2026-06-15" });
  });

  it("does not suggest a dividend the user didn't hold shares for yet at the ex-date", async () => {
    const repo = makeAssetRepo();
    const dividendsCache = makeDividendsCache({
      PETR4: [{ ticker: "PETR4", type: "DIVIDENDO", rate: 1.5, exDate: "2026-01-01", paymentDate: "2026-01-15", relatedTo: "1T2026" }],
    });
    const service = new B3ImportService(repo, dividendsCache);

    // bought AFTER the ex-date -> held zero shares on the ex-date -> not entitled to this payment
    const negociacao = [{ dataNegocio: "01/06/2026", tipoMovimentacao: "Compra", mercado: "Mercado à Vista", codigoNegociacao: "PETR4", quantidade: 10, preco: 30, valor: 300 }];
    const result = await service.preview("user-1", negociacao, []);

    expect(result.suggestedIncomes).toHaveLength(0);
  });

  it("does not suggest a dividend that's already covered by an imported or existing income (within tolerance)", async () => {
    const repo = makeAssetRepo();
    const dividendsCache = makeDividendsCache({
      PETR4: [{ ticker: "PETR4", type: "DIVIDENDO", rate: 1.5, exDate: "2026-06-15", paymentDate: "2026-07-01", relatedTo: "2T2026" }],
    });
    const service = new B3ImportService(repo, dividendsCache);

    const negociacao = [{ dataNegocio: "01/06/2026", tipoMovimentacao: "Compra", mercado: "Mercado à Vista", codigoNegociacao: "PETR4", quantidade: 10, preco: 30, valor: 300 }];
    // statement already reports this exact dividend (10 * 1.5 = 15) a couple days off from BRAPI's date
    const movimentacao = [{ data: "03/07/2026", movimentacao: "Dividendo", produto: "PETR4 - PETROLEO BRASILEIRO S.A.", quantidade: 10, precoUnitario: 1.5, valorOperacao: 15 }];

    const result = await service.preview("user-1", negociacao, movimentacao);

    expect(result.incomes).toHaveLength(1); // the real statement row is still imported
    expect(result.suggestedIncomes).toHaveLength(0); // but not suggested again as a "missing" one
  });
});

describe("B3ImportService.commit", () => {
  it("creates a new asset when the ticker isn't owned yet, then adds the transaction/income to it", async () => {
    const repo = makeAssetRepo();
    const service = new B3ImportService(repo, makeDividendsCache());

    await service.commit(
      "user-1",
      [{ ticker: "PETR4", assetClass: "STOCK", assetName: "Petrobras", type: "BUY", quantity: 10, unitPrice: 30, transactionDate: "2026-01-01", sourceLabel: "Compra" }],
      [{ ticker: "PETR4", assetClass: "STOCK", type: "DIVIDENDO", amount: 15, paymentDate: "2026-07-01", sourceLabel: "Dividendo" }],
    );

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.addTransaction).toHaveBeenCalledTimes(1);
    expect(repo.addIncome).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing asset instead of creating a duplicate", async () => {
    const repo = makeAssetRepo({ findByUserAndTicker: jest.fn().mockResolvedValue({ id: "existing-asset-id" }) });
    const service = new B3ImportService(repo, makeDividendsCache());

    await service.commit(
      "user-1",
      [{ ticker: "PETR4", assetClass: "STOCK", type: "BUY", quantity: 10, unitPrice: 30, transactionDate: "2026-01-01" }],
      [],
    );

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.addTransaction).toHaveBeenCalledWith(expect.objectContaining({ assetId: "existing-asset-id" }));
  });

  it("reuses the same resolved asset across multiple rows for the same ticker instead of re-querying", async () => {
    const repo = makeAssetRepo();
    const service = new B3ImportService(repo, makeDividendsCache());

    await service.commit(
      "user-1",
      [
        { ticker: "PETR4", assetClass: "STOCK", type: "BUY", quantity: 10, unitPrice: 30, transactionDate: "2026-01-01" },
        { ticker: "PETR4", assetClass: "STOCK", type: "BUY", quantity: 5, unitPrice: 32, transactionDate: "2026-02-01" },
      ],
      [],
    );

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.findByUserAndTicker).toHaveBeenCalledTimes(1);
  });
});
