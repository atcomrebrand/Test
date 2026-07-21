import { AssetsService } from "./assets.service";
import { AssetRepository } from "../domain/asset.repository";
import { MarketPriceService } from "../infrastructure/market-price.service";
import { DividendAutoSyncService } from "./dividend-auto-sync.service";

function makeAssetRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    findAllByUser: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findByIdWithTransactions: jest.fn(),
    listTransactions: jest.fn().mockResolvedValue([]),
    listIncomes: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as AssetRepository;
}

function makeMarketPrice(): MarketPriceService {
  return { getPrice: jest.fn().mockResolvedValue(null), getDetail: jest.fn(), getHistory: jest.fn() } as unknown as MarketPriceService;
}

describe("AssetsService — dividend sync reaches the portfolio list and dashboard, not just the asset page", () => {
  it("findAll() runs the dividend sync for every asset, not just ones individually opened", async () => {
    const syncAsset = jest.fn().mockResolvedValue(0);
    const asset = { id: "a1", userId: "user-1", class: "STOCK", ticker: "PETR4", stakingApyPercent: null };
    const assets = makeAssetRepo({ findAllByUser: jest.fn().mockResolvedValue([asset]) });
    const service = new AssetsService(assets, makeMarketPrice(), { syncAsset } as unknown as DividendAutoSyncService);

    await service.findAll("user-1");

    expect(syncAsset).toHaveBeenCalledWith("user-1", "a1");
  });

  it("findOne() returns incomeHistory captured AFTER the sync, so a newly-recorded payment shows up immediately", async () => {
    const asset = { id: "a1", userId: "user-1", class: "STOCK", ticker: "PETR4", stakingApyPercent: null };
    const preSync = [{ id: "old-income", amount: "5" as any, paymentDate: new Date("2026-01-01") }];
    const postSync = [...preSync, { id: "new-income", amount: "10" as any, paymentDate: new Date("2026-06-01") }];

    let synced = false;
    const syncAsset = jest.fn().mockImplementation(async () => {
      synced = true;
      return 1;
    });
    const listIncomes = jest.fn().mockImplementation(async () => (synced ? postSync : preSync));

    const assets = makeAssetRepo({
      findById: jest.fn().mockResolvedValue(asset),
      findByIdWithTransactions: jest.fn().mockResolvedValue({ ...asset, transactions: [], incomes: preSync }),
      listIncomes,
    });
    const service = new AssetsService(assets, makeMarketPrice(), { syncAsset } as unknown as DividendAutoSyncService);

    const result = await service.findOne("user-1", "a1");

    expect(syncAsset).toHaveBeenCalledWith("user-1", "a1");
    expect(result.incomeHistory).toEqual(postSync);
    expect(result.incomeHistory).not.toEqual(preSync);
  });
});
