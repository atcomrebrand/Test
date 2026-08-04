import { DividendsCacheService } from "./dividends-cache.service";
import { StockQuoteProvider } from "../domain/market-data.provider";
import { B3DividendsProvider } from "./providers/b3-dividends.provider";
import { FundamentusProvider } from "./providers/fundamentus.provider";
import { YahooDividendsProvider } from "./providers/yahoo-dividends.provider";

function makeStockProvider(fetchDividends: jest.Mock): StockQuoteProvider {
  return { fetchDividends } as unknown as StockQuoteProvider;
}

function makeFundamentus(fetchProventos: jest.Mock): FundamentusProvider {
  return { fetchProventos } as unknown as FundamentusProvider;
}

function makeB3(fetchDividends: jest.Mock): B3DividendsProvider {
  return { fetchDividends } as unknown as B3DividendsProvider;
}

function makeYahoo(fetchDividends: jest.Mock): YahooDividendsProvider {
  return { fetchDividends } as unknown as YahooDividendsProvider;
}

function makeService(mocks: { brapi?: jest.Mock; fundamentus?: jest.Mock; b3?: jest.Mock; yahoo?: jest.Mock }) {
  return new DividendsCacheService(
    makeStockProvider(mocks.brapi ?? jest.fn()),
    makeFundamentus(mocks.fundamentus ?? jest.fn()),
    makeB3(mocks.b3 ?? jest.fn()),
    makeYahoo(mocks.yahoo ?? jest.fn()),
  );
}

describe("DividendsCacheService", () => {
  it("returns BRAPI's result directly when it succeeds, without touching any fallback", async () => {
    const brapiEvents = [{ ticker: "PETR4", type: "DIVIDENDO" as const, rate: 1, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }];
    const mocks = { brapi: jest.fn().mockResolvedValue(brapiEvents), fundamentus: jest.fn(), b3: jest.fn(), yahoo: jest.fn() };

    const events = await makeService(mocks).get("PETR4", "STOCK");

    expect(events).toBe(brapiEvents);
    expect(mocks.fundamentus).not.toHaveBeenCalled();
    expect(mocks.b3).not.toHaveBeenCalled();
    expect(mocks.yahoo).not.toHaveBeenCalled();
  });

  it("falls back to Fundamentus when BRAPI throws, before B3 or Yahoo", async () => {
    const fundamentusEvents = [{ ticker: "BBAS3", type: "JCP" as const, rate: 0.09, exDate: "2026-03-01", paymentDate: "2026-03-31", relatedTo: null }];
    const mocks = {
      brapi: jest.fn().mockRejectedValue(new Error("BRAPI v2 dividends request failed for BBAS3: 403")),
      fundamentus: jest.fn().mockResolvedValue(fundamentusEvents),
      b3: jest.fn(),
      yahoo: jest.fn(),
    };

    const events = await makeService(mocks).get("BBAS3", "STOCK");

    expect(events).toBe(fundamentusEvents);
    expect(mocks.fundamentus).toHaveBeenCalledWith("BBAS3", "STOCK");
    expect(mocks.b3).not.toHaveBeenCalled();
    expect(mocks.yahoo).not.toHaveBeenCalled();
  });

  it("tries B3 for a STOCK when BRAPI and Fundamentus both fail, before Yahoo", async () => {
    const b3Events = [{ ticker: "BBAS3", type: "DIVIDENDO" as const, rate: 0.08, exDate: "2026-03-01", paymentDate: null, relatedTo: null }];
    const mocks = {
      brapi: jest.fn().mockRejectedValue(new Error("BRAPI down")),
      fundamentus: jest.fn().mockRejectedValue(new Error("Fundamentus down")),
      b3: jest.fn().mockResolvedValue(b3Events),
      yahoo: jest.fn(),
    };

    const events = await makeService(mocks).get("BBAS3", "STOCK");

    expect(events).toBe(b3Events);
    expect(mocks.b3).toHaveBeenCalledWith("BBAS3");
    expect(mocks.yahoo).not.toHaveBeenCalled();
  });

  it("skips the B3 leg for FIIs, going straight from Fundamentus to Yahoo", async () => {
    const yahooEvents = [{ ticker: "MXRF11", type: "OUTRO" as const, rate: 0.1, exDate: "2026-03-01", paymentDate: null, relatedTo: "Fonte: Yahoo Finance" }];
    const mocks = {
      brapi: jest.fn().mockRejectedValue(new Error("BRAPI down")),
      fundamentus: jest.fn().mockRejectedValue(new Error("Fundamentus down")),
      b3: jest.fn(),
      yahoo: jest.fn().mockResolvedValue(yahooEvents),
    };

    const events = await makeService(mocks).get("MXRF11", "FII");

    expect(events).toBe(yahooEvents);
    expect(mocks.b3).not.toHaveBeenCalled();
  });

  it("returns an empty array (not a throw) when every source fails", async () => {
    const mocks = {
      brapi: jest.fn().mockRejectedValue(new Error("BRAPI down")),
      fundamentus: jest.fn().mockRejectedValue(new Error("Fundamentus down")),
      b3: jest.fn().mockRejectedValue(new Error("B3 down")),
      yahoo: jest.fn().mockRejectedValue(new Error("Yahoo also down")),
    };

    const events = await makeService(mocks).get("PETR4", "STOCK");

    expect(events).toEqual([]);
  });

  it("caches a fallback result so a second call within the TTL doesn't hit any provider again", async () => {
    const fundamentusEvents = [{ ticker: "BBAS3", type: "JCP" as const, rate: 0.09, exDate: "2026-03-01", paymentDate: "2026-03-31", relatedTo: null }];
    const mocks = {
      brapi: jest.fn().mockRejectedValue(new Error("403")),
      fundamentus: jest.fn().mockResolvedValue(fundamentusEvents),
      b3: jest.fn(),
      yahoo: jest.fn(),
    };
    const service = makeService(mocks);

    await service.get("BBAS3", "STOCK");
    const second = await service.get("BBAS3", "STOCK");

    expect(second).toBe(fundamentusEvents);
    expect(mocks.brapi).toHaveBeenCalledTimes(1);
    expect(mocks.fundamentus).toHaveBeenCalledTimes(1);
  });
});
