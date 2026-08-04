import { DividendsCacheService } from "./dividends-cache.service";
import { StockQuoteProvider } from "../domain/market-data.provider";
import { FundamentusProvider } from "./providers/fundamentus.provider";
import { YahooDividendsProvider } from "./providers/yahoo-dividends.provider";

function makeStockProvider(fetchDividends: jest.Mock): StockQuoteProvider {
  return { fetchDividends } as unknown as StockQuoteProvider;
}

function makeFundamentus(fetchProventos: jest.Mock): FundamentusProvider {
  return { fetchProventos } as unknown as FundamentusProvider;
}

function makeYahoo(fetchDividends: jest.Mock): YahooDividendsProvider {
  return { fetchDividends } as unknown as YahooDividendsProvider;
}

describe("DividendsCacheService", () => {
  it("returns BRAPI's result directly when it succeeds, without touching either fallback", async () => {
    const brapiEvents = [{ ticker: "PETR4", type: "DIVIDENDO" as const, rate: 1, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }];
    const stockProvider = makeStockProvider(jest.fn().mockResolvedValue(brapiEvents));
    const fundamentusFetch = jest.fn();
    const yahooFetch = jest.fn();
    const service = new DividendsCacheService(stockProvider, makeFundamentus(fundamentusFetch), makeYahoo(yahooFetch));

    const events = await service.get("PETR4", "STOCK");

    expect(events).toBe(brapiEvents);
    expect(fundamentusFetch).not.toHaveBeenCalled();
    expect(yahooFetch).not.toHaveBeenCalled();
  });

  it("falls back to Fundamentus when BRAPI throws (e.g. the free-plan 403 on stock dividends), before ever trying Yahoo", async () => {
    const fundamentusEvents = [{ ticker: "BBAS3", type: "JCP" as const, rate: 0.09, exDate: "2026-03-01", paymentDate: "2026-03-31", relatedTo: null }];
    const stockProvider = makeStockProvider(jest.fn().mockRejectedValue(new Error("BRAPI v2 dividends request failed for BBAS3: 403")));
    const fundamentusFetch = jest.fn().mockResolvedValue(fundamentusEvents);
    const yahooFetch = jest.fn();
    const service = new DividendsCacheService(stockProvider, makeFundamentus(fundamentusFetch), makeYahoo(yahooFetch));

    const events = await service.get("BBAS3", "STOCK");

    expect(events).toBe(fundamentusEvents);
    expect(fundamentusFetch).toHaveBeenCalledWith("BBAS3", "STOCK");
    expect(yahooFetch).not.toHaveBeenCalled();
  });

  it("falls through to Yahoo Finance when both BRAPI and Fundamentus fail", async () => {
    const yahooEvents = [{ ticker: "BBAS3", type: "OUTRO" as const, rate: 0.07, exDate: "2026-03-01", paymentDate: null, relatedTo: "Fonte: Yahoo Finance" }];
    const stockProvider = makeStockProvider(jest.fn().mockRejectedValue(new Error("BRAPI down")));
    const fundamentusFetch = jest.fn().mockRejectedValue(new Error("Fundamentus proventos request failed for BBAS3: 403"));
    const yahooFetch = jest.fn().mockResolvedValue(yahooEvents);
    const service = new DividendsCacheService(stockProvider, makeFundamentus(fundamentusFetch), makeYahoo(yahooFetch));

    const events = await service.get("BBAS3", "STOCK");

    expect(events).toBe(yahooEvents);
    expect(yahooFetch).toHaveBeenCalledWith("BBAS3");
  });

  it("returns an empty array (not a throw) when all three sources fail", async () => {
    const stockProvider = makeStockProvider(jest.fn().mockRejectedValue(new Error("BRAPI down")));
    const fundamentusFetch = jest.fn().mockRejectedValue(new Error("Fundamentus down"));
    const yahooFetch = jest.fn().mockRejectedValue(new Error("Yahoo also down"));
    const service = new DividendsCacheService(stockProvider, makeFundamentus(fundamentusFetch), makeYahoo(yahooFetch));

    const events = await service.get("PETR4", "STOCK");

    expect(events).toEqual([]);
  });

  it("caches a fallback result so a second call within the TTL doesn't hit any provider again", async () => {
    const fundamentusEvents = [{ ticker: "BBAS3", type: "JCP" as const, rate: 0.09, exDate: "2026-03-01", paymentDate: "2026-03-31", relatedTo: null }];
    const stockFetch = jest.fn().mockRejectedValue(new Error("403"));
    const fundamentusFetch = jest.fn().mockResolvedValue(fundamentusEvents);
    const yahooFetch = jest.fn();
    const service = new DividendsCacheService(makeStockProvider(stockFetch), makeFundamentus(fundamentusFetch), makeYahoo(yahooFetch));

    await service.get("BBAS3", "STOCK");
    const second = await service.get("BBAS3", "STOCK");

    expect(second).toBe(fundamentusEvents);
    expect(stockFetch).toHaveBeenCalledTimes(1);
    expect(fundamentusFetch).toHaveBeenCalledTimes(1);
  });
});
