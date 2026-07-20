import { DividendAutoSyncService } from "./dividend-auto-sync.service";
import { AssetRepository } from "../domain/asset.repository";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

function makeAssetRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    findById: jest.fn(),
    listTransactions: jest.fn().mockResolvedValue([]),
    listIncomes: jest.fn().mockResolvedValue([]),
    addIncome: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as AssetRepository;
}

function makeDividendsCache(events: unknown[] = []): DividendsCacheService {
  return { get: jest.fn().mockResolvedValue(events) } as unknown as DividendsCacheService;
}

function tx(type: "BUY" | "SELL", quantity: number, transactionDate: string) {
  return { type, quantity, unitPrice: 10, fees: 0, transactionDate: new Date(transactionDate) };
}

describe("DividendAutoSyncService.syncAsset", () => {
  it("auto-records an unmatched BRAPI event, valued at the position held on its ex-date", async () => {
    const assets = makeAssetRepo({
      findById: jest.fn().mockResolvedValue({ id: "a1", class: "STOCK", ticker: "PETR4" }),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 10, "2026-01-01")]),
    });
    const dividends = makeDividendsCache([{ ticker: "PETR4", type: "DIVIDENDO", rate: 1.5, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }]);

    const service = new DividendAutoSyncService(assets, dividends);
    const created = await service.syncAsset("user-1", "a1");

    expect(created).toBe(1);
    expect(assets.addIncome).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", assetId: "a1", type: "DIVIDENDO", amount: 15, paymentDate: new Date("2026-03-15") }),
    );
  });

  it("does not create a duplicate for an event already matched by an existing income", async () => {
    const assets = makeAssetRepo({
      findById: jest.fn().mockResolvedValue({ id: "a1", class: "STOCK", ticker: "PETR4" }),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 10, "2026-01-01")]),
      listIncomes: jest.fn().mockResolvedValue([{ amount: 15 as any, paymentDate: new Date("2026-03-15") }]),
    });
    const dividends = makeDividendsCache([{ ticker: "PETR4", type: "DIVIDENDO", rate: 1.5, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }]);

    const service = new DividendAutoSyncService(assets, dividends);
    const created = await service.syncAsset("user-1", "a1");

    expect(created).toBe(0);
    expect(assets.addIncome).not.toHaveBeenCalled();
  });

  it("skips an event whose ex-date is before the asset was ever acquired", async () => {
    const assets = makeAssetRepo({
      findById: jest.fn().mockResolvedValue({ id: "a1", class: "STOCK", ticker: "VALE3" }),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 5, "2026-06-01")]),
    });
    const dividends = makeDividendsCache([{ ticker: "VALE3", type: "DIVIDENDO", rate: 3, exDate: "2025-01-01", paymentDate: "2025-01-15", relatedTo: null }]);

    const service = new DividendAutoSyncService(assets, dividends);
    const created = await service.syncAsset("user-1", "a1");

    expect(created).toBe(0);
    expect(assets.addIncome).not.toHaveBeenCalled();
  });

  it("no-ops for CRYPTO assets — dividends only exist for STOCK/FII", async () => {
    const assets = makeAssetRepo({ findById: jest.fn().mockResolvedValue({ id: "a1", class: "CRYPTO", ticker: "BTC" }) });
    const dividends = makeDividendsCache();

    const service = new DividendAutoSyncService(assets, dividends);
    const created = await service.syncAsset("user-1", "a1");

    expect(created).toBe(0);
    expect(dividends.get).not.toHaveBeenCalled();
  });

  it("is best-effort: a BRAPI/lookup failure returns 0 instead of throwing", async () => {
    const assets = makeAssetRepo({
      findById: jest.fn().mockResolvedValue({ id: "a1", class: "STOCK", ticker: "PETR4" }),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 10, "2026-01-01")]),
    });
    const dividends = { get: jest.fn().mockRejectedValue(new Error("BRAPI down")) } as unknown as DividendsCacheService;

    const service = new DividendAutoSyncService(assets, dividends);
    await expect(service.syncAsset("user-1", "a1")).resolves.toBe(0);
  });
});
