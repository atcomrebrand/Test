import { DividendsCacheService } from "./dividends-cache.service";
import { StockQuoteProvider } from "../domain/market-data.provider";
import { YahooDividendsProvider } from "./providers/yahoo-dividends.provider";

function makeStockProvider(fetchDividends: jest.Mock): StockQuoteProvider {
  return { fetchDividends } as unknown as StockQuoteProvider;
}

function makeYahoo(fetchDividends: jest.Mock): YahooDividendsProvider {
  return { fetchDividends } as unknown as YahooDividendsProvider;
}

describe("DividendsCacheService", () => {
  it("returns BRAPI's result directly when it succeeds, without touching the Yahoo fallback", async () => {
    const brapiEvents = [{ ticker: "PETR4", type: "DIVIDENDO" as const, rate: 1, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }];
    const stockProvider = makeStockProvider(jest.fn().mockResolvedValue(brapiEvents));
    const yahooFetch = jest.fn();
    const service = new DividendsCacheService(stockProvider, makeYahoo(yahooFetch));

    const events = await service.get("PETR4", "STOCK");

    expect(events).toBe(brapiEvents);
    expect(yahooFetch).not.toHaveBeenCalled();
  });

  it("falls back to Yahoo Finance when BRAPI throws (e.g. the free-plan 403 on stock dividends)", async () => {
    const yahooEvents = [{ ticker: "BBAS3", type: "OUTRO" as const, rate: 0.07, exDate: "2026-03-01", paymentDate: null, relatedTo: "Fonte: Yahoo Finance" }];
    const stockProvider = makeStockProvider(jest.fn().mockRejectedValue(new Error("BRAPI v2 dividends request failed for BBAS3: 403")));
    const yahooFetch = jest.fn().mockResolvedValue(yahooEvents);
    const service = new DividendsCacheService(stockProvider, makeYahoo(yahooFetch));

    const events = await service.get("BBAS3", "STOCK");

    expect(events).toBe(yahooEvents);
    expect(yahooFetch).toHaveBeenCalledWith("BBAS3");
  });

  it("returns an empty array (not a throw) when both BRAPI and the Yahoo fallback fail", async () => {
    const stockProvider = makeStockProvider(jest.fn().mockRejectedValue(new Error("BRAPI down")));
    const yahooFetch = jest.fn().mockRejectedValue(new Error("Yahoo also down"));
    const service = new DividendsCacheService(stockProvider, makeYahoo(yahooFetch));

    const events = await service.get("PETR4", "STOCK");

    expect(events).toEqual([]);
  });

  it("caches the Yahoo fallback result so a second call within the TTL doesn't hit either provider again", async () => {
    const yahooEvents = [{ ticker: "BBAS3", type: "OUTRO" as const, rate: 0.07, exDate: "2026-03-01", paymentDate: null, relatedTo: "Fonte: Yahoo Finance" }];
    const stockFetch = jest.fn().mockRejectedValue(new Error("403"));
    const yahooFetch = jest.fn().mockResolvedValue(yahooEvents);
    const service = new DividendsCacheService(makeStockProvider(stockFetch), makeYahoo(yahooFetch));

    await service.get("BBAS3", "STOCK");
    const second = await service.get("BBAS3", "STOCK");

    expect(second).toBe(yahooEvents);
    expect(stockFetch).toHaveBeenCalledTimes(1);
    expect(yahooFetch).toHaveBeenCalledTimes(1);
  });
});
