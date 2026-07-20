import { DividendsService } from "./dividends.service";
import { AssetRepository } from "../domain/asset.repository";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

function makeAssetRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    findAllByUser: jest.fn(),
    listTransactions: jest.fn(),
    ...overrides,
  } as unknown as AssetRepository;
}

function makeDividendsCache(events: Record<string, unknown[]> = {}): DividendsCacheService {
  return {
    get: jest.fn().mockImplementation(async (ticker: string) => events[ticker] ?? []),
  } as unknown as DividendsCacheService;
}

function tx(type: "BUY" | "SELL", quantity: number, transactionDate: string) {
  return { type, quantity, unitPrice: 10, fees: 0, transactionDate: new Date(transactionDate) };
}

describe("DividendsService.getPortfolioCalendar", () => {
  it("values each event against the position held on ITS OWN ex-date, not today's position", async () => {
    // Bought 10 on 2026-01-01, bought 10 more on 2026-06-01 (now holds 20).
    const assets = makeAssetRepo({
      findAllByUser: jest.fn().mockResolvedValue([{ id: "a1", class: "STOCK", ticker: "PETR4", name: "Petrobras" }]),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 10, "2026-01-01"), tx("BUY", 10, "2026-06-01")]),
    });
    const dividends = makeDividendsCache({
      PETR4: [
        // Ex-date before the second purchase — should be valued at 10 shares, not the current 20.
        { ticker: "PETR4", type: "DIVIDENDO", rate: 1, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null },
        // Ex-date after the second purchase — should be valued at the full 20 shares.
        { ticker: "PETR4", type: "DIVIDENDO", rate: 2, exDate: "2026-07-01", paymentDate: "2026-07-15", relatedTo: null },
      ],
    });

    const service = new DividendsService(dividends, assets);
    const entries = await service.getPortfolioCalendar("user-1");

    const march = entries.find((e) => e.exDate === "2026-03-01")!;
    expect(march.quantityHeld).toBe(10);
    expect(march.estimatedAmount).toBe(10);

    const july = entries.find((e) => e.exDate === "2026-07-01")!;
    expect(july.quantityHeld).toBe(20);
    expect(july.estimatedAmount).toBe(40);
  });

  it("excludes an event whose ex-date is before the asset was ever acquired", async () => {
    const assets = makeAssetRepo({
      findAllByUser: jest.fn().mockResolvedValue([{ id: "a1", class: "STOCK", ticker: "VALE3", name: "Vale" }]),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 5, "2026-06-01")]),
    });
    const dividends = makeDividendsCache({
      VALE3: [{ ticker: "VALE3", type: "DIVIDENDO", rate: 3, exDate: "2025-01-01", paymentDate: "2025-01-15", relatedTo: null }],
    });

    const service = new DividendsService(dividends, assets);
    const entries = await service.getPortfolioCalendar("user-1");

    expect(entries).toHaveLength(0);
  });

  it("still values a fully-since-sold asset's past dividends at the quantity held back then", async () => {
    const assets = makeAssetRepo({
      findAllByUser: jest.fn().mockResolvedValue([{ id: "a1", class: "STOCK", ticker: "WEGE3", name: "WEG" }]),
      listTransactions: jest.fn().mockResolvedValue([tx("BUY", 10, "2026-01-01"), tx("SELL", 10, "2026-05-01")]),
    });
    const dividends = makeDividendsCache({
      WEGE3: [{ ticker: "WEGE3", type: "DIVIDENDO", rate: 1, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }],
    });

    const service = new DividendsService(dividends, assets);
    const entries = await service.getPortfolioCalendar("user-1");

    expect(entries).toHaveLength(1);
    expect(entries[0].quantityHeld).toBe(10);
    expect(entries[0].estimatedAmount).toBe(10);
  });
});
