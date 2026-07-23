import { TrackingFxService } from "./tracking-fx.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxRateProvider } from "../domain/tracking-fx.provider";
import { ExchangerateFxProvider } from "../infrastructure/providers/exchangerate-fx.provider";
import { CurrencyApiFxProvider } from "../infrastructure/providers/currency-api-fx.provider";

function makePrisma(cached: { rate: unknown; fetchedAt: Date } | null) {
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

function makeFallbackProvider(fetchUsdToBrl: jest.Mock): ExchangerateFxProvider {
  return { fetchUsdToBrl } as unknown as ExchangerateFxProvider;
}

function makeSecondFallbackProvider(fetchUsdToBrl: jest.Mock): CurrencyApiFxProvider {
  return { fetchUsdToBrl } as unknown as CurrencyApiFxProvider;
}

const NEVER_CALLED = makeFallbackProvider(jest.fn());
const NEVER_CALLED_2 = makeSecondFallbackProvider(jest.fn());

describe("TrackingFxService.getUsdToBrlRate", () => {
  it("fetches from the primary provider and caches it when there's nothing cached yet", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockResolvedValue(5.5));
    const service = new TrackingFxService(prisma, provider, NEVER_CALLED, NEVER_CALLED_2);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.5);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.5 }) }),
    );
  });

  it("returns the cached rate without calling any provider when the cache is fresh", async () => {
    const prisma = makePrisma({ rate: 5.2 as unknown, fetchedAt: new Date() });
    const fetchUsdToBrl = jest.fn();
    const service = new TrackingFxService(prisma, makeProvider(fetchUsdToBrl), NEVER_CALLED, NEVER_CALLED_2);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.2);
    expect(fetchUsdToBrl).not.toHaveBeenCalled();
  });

  it("refetches when the cache is stale", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.0 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockResolvedValue(5.9));
    const service = new TrackingFxService(prisma, provider, NEVER_CALLED, NEVER_CALLED_2);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.9);
  });

  it("falls back to the second provider when the primary fails", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI 403")));
    const fallback = makeFallbackProvider(jest.fn().mockResolvedValue(5.45));
    const service = new TrackingFxService(prisma, provider, fallback, NEVER_CALLED_2);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.45);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.45 }) }),
    );
  });

  it("falls back to the third provider when the first two fail", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI 403")));
    const fallback = makeFallbackProvider(jest.fn().mockRejectedValue(new Error("open.er-api.com down")));
    const secondFallback = makeSecondFallbackProvider(jest.fn().mockResolvedValue(5.6));
    const service = new TrackingFxService(prisma, provider, fallback, secondFallback);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.6);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.6 }) }),
    );
  });

  it("falls back to the stale cached rate when all three providers fail", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.1 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const fallback = makeFallbackProvider(jest.fn().mockRejectedValue(new Error("fallback down too")));
    const secondFallback = makeSecondFallbackProvider(jest.fn().mockRejectedValue(new Error("CDN down too")));
    const service = new TrackingFxService(prisma, provider, fallback, secondFallback);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.1);
  });

  it("returns null when all three providers fail and nothing was ever cached", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const fallback = makeFallbackProvider(jest.fn().mockRejectedValue(new Error("fallback down too")));
    const secondFallback = makeSecondFallbackProvider(jest.fn().mockRejectedValue(new Error("CDN down too")));
    const service = new TrackingFxService(prisma, provider, fallback, secondFallback);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBeNull();
  });
});
