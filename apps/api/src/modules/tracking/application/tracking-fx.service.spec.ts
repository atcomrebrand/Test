import { TrackingFxService } from "./tracking-fx.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxRateProvider } from "../domain/tracking-fx.provider";
import { YahooFxProvider } from "../infrastructure/providers/yahoo-fx.provider";
import { ExchangerateFxProvider } from "../infrastructure/providers/exchangerate-fx.provider";
import { CurrencyApiFxProvider } from "../infrastructure/providers/currency-api-fx.provider";

function makePrisma(cached: { rate: unknown; previousClose?: unknown; fetchedAt: Date } | null) {
  return {
    trackingFxRateCache: {
      findUnique: jest.fn().mockResolvedValue(cached),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaService;
}

function makeProvider(fetchUsdToBrl: jest.Mock): TrackingFxRateProvider {
  return { fetchUsdToBrl } as unknown as TrackingFxRateProvider;
}

function makeYahooFallback(fetchUsdToBrl: jest.Mock): YahooFxProvider {
  return { fetchUsdToBrl } as unknown as YahooFxProvider;
}

function makeExchangerateFallback(fetchUsdToBrl: jest.Mock): ExchangerateFxProvider {
  return { fetchUsdToBrl } as unknown as ExchangerateFxProvider;
}

function makeCdnFallback(fetchUsdToBrl: jest.Mock): CurrencyApiFxProvider {
  return { fetchUsdToBrl } as unknown as CurrencyApiFxProvider;
}

const NEVER_YAHOO = makeYahooFallback(jest.fn());
const NEVER_EXCHANGERATE = makeExchangerateFallback(jest.fn());
const NEVER_CDN = makeCdnFallback(jest.fn());

describe("TrackingFxService.getUsdToBrlRate", () => {
  it("fetches from the primary provider and caches it when there's nothing cached yet", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockResolvedValue({ rate: 5.5, previousClose: 5.4 }));
    const service = new TrackingFxService(prisma, provider, NEVER_YAHOO, NEVER_EXCHANGERATE, NEVER_CDN);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.5);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.5, previousClose: 5.4 }) }),
    );
  });

  it("returns the cached rate without calling any provider when the cache is fresh", async () => {
    const prisma = makePrisma({ rate: 5.2 as unknown, fetchedAt: new Date() });
    const fetchUsdToBrl = jest.fn();
    const service = new TrackingFxService(prisma, makeProvider(fetchUsdToBrl), NEVER_YAHOO, NEVER_EXCHANGERATE, NEVER_CDN);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.2);
    expect(fetchUsdToBrl).not.toHaveBeenCalled();
  });

  it("refetches when the cache is stale", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.0 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockResolvedValue({ rate: 5.9, previousClose: null }));
    const service = new TrackingFxService(prisma, provider, NEVER_YAHOO, NEVER_EXCHANGERATE, NEVER_CDN);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.9);
  });

  it("falls back to Yahoo Finance when the primary fails — before the daily-snapshot sources", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI 429")));
    const yahoo = makeYahooFallback(jest.fn().mockResolvedValue({ rate: 5.1, previousClose: 5.08 }));
    const service = new TrackingFxService(prisma, provider, yahoo, NEVER_EXCHANGERATE, NEVER_CDN);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.1);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.1, previousClose: 5.08 }) }),
    );
  });

  it("falls back to open.er-api.com when the primary and Yahoo both fail", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI 429")));
    const yahoo = makeYahooFallback(jest.fn().mockRejectedValue(new Error("Yahoo down")));
    const exchangerate = makeExchangerateFallback(jest.fn().mockResolvedValue({ rate: 5.45, previousClose: null }));
    const service = new TrackingFxService(prisma, provider, yahoo, exchangerate, NEVER_CDN);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.45);
  });

  it("falls back to the CDN source when the first three fail", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI 429")));
    const yahoo = makeYahooFallback(jest.fn().mockRejectedValue(new Error("Yahoo down")));
    const exchangerate = makeExchangerateFallback(jest.fn().mockRejectedValue(new Error("open.er-api.com down")));
    const cdn = makeCdnFallback(jest.fn().mockResolvedValue({ rate: 5.6, previousClose: null }));
    const service = new TrackingFxService(prisma, provider, yahoo, exchangerate, cdn);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.6);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.6, previousClose: null }) }),
    );
  });

  it("falls back to the stale cached rate when all four providers fail", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.1 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const yahoo = makeYahooFallback(jest.fn().mockRejectedValue(new Error("Yahoo down")));
    const exchangerate = makeExchangerateFallback(jest.fn().mockRejectedValue(new Error("fallback down too")));
    const cdn = makeCdnFallback(jest.fn().mockRejectedValue(new Error("CDN down too")));
    const service = new TrackingFxService(prisma, provider, yahoo, exchangerate, cdn);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.1);
  });

  it("returns null when all four providers fail and nothing was ever cached", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const yahoo = makeYahooFallback(jest.fn().mockRejectedValue(new Error("Yahoo down")));
    const exchangerate = makeExchangerateFallback(jest.fn().mockRejectedValue(new Error("fallback down too")));
    const cdn = makeCdnFallback(jest.fn().mockRejectedValue(new Error("CDN down too")));
    const service = new TrackingFxService(prisma, provider, yahoo, exchangerate, cdn);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBeNull();
  });
});

describe("TrackingFxService.getUsdToBrlQuote", () => {
  it("returns rate and previousClose together", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockResolvedValue({ rate: 5.5, previousClose: 5.4 }));
    const service = new TrackingFxService(prisma, provider, NEVER_YAHOO, NEVER_EXCHANGERATE, NEVER_CDN);

    const quote = await service.getUsdToBrlQuote();

    expect(quote).toEqual({ rate: 5.5, previousClose: 5.4 });
  });

  it("reads previousClose back from a fresh cache row", async () => {
    const prisma = makePrisma({ rate: 5.2 as unknown, previousClose: 5.15 as unknown, fetchedAt: new Date() });
    const service = new TrackingFxService(prisma, makeProvider(jest.fn()), NEVER_YAHOO, NEVER_EXCHANGERATE, NEVER_CDN);

    const quote = await service.getUsdToBrlQuote();

    expect(quote).toEqual({ rate: 5.2, previousClose: 5.15 });
  });

  it("returns null previousClose when nothing was ever cached and every provider fails", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("down")));
    const yahoo = makeYahooFallback(jest.fn().mockRejectedValue(new Error("down")));
    const exchangerate = makeExchangerateFallback(jest.fn().mockRejectedValue(new Error("down")));
    const cdn = makeCdnFallback(jest.fn().mockRejectedValue(new Error("down")));
    const service = new TrackingFxService(prisma, provider, yahoo, exchangerate, cdn);

    const quote = await service.getUsdToBrlQuote();

    expect(quote).toBeNull();
  });
});
