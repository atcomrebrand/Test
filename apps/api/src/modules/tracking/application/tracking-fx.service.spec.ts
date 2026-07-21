import { TrackingFxService } from "./tracking-fx.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxRateProvider } from "../domain/tracking-fx.provider";

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

describe("TrackingFxService.getUsdToBrlRate", () => {
  it("fetches from the provider and caches it when there's nothing cached yet", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockResolvedValue(5.5));
    const service = new TrackingFxService(prisma, provider);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.5);
    expect(prisma.trackingFxRateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ pair: "USDBRL", rate: 5.5 }) }),
    );
  });

  it("returns the cached rate without calling the provider when the cache is fresh", async () => {
    const prisma = makePrisma({ rate: 5.2 as unknown, fetchedAt: new Date() });
    const fetchUsdToBrl = jest.fn();
    const service = new TrackingFxService(prisma, makeProvider(fetchUsdToBrl));

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.2);
    expect(fetchUsdToBrl).not.toHaveBeenCalled();
  });

  it("refetches when the cache is stale", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.0 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockResolvedValue(5.9));
    const service = new TrackingFxService(prisma, provider);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.9);
  });

  it("falls back to the stale cached rate when the provider fails", async () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const prisma = makePrisma({ rate: 5.1 as unknown, fetchedAt: staleDate });
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const service = new TrackingFxService(prisma, provider);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBe(5.1);
  });

  it("returns null when the provider fails and nothing was ever cached", async () => {
    const prisma = makePrisma(null);
    const provider = makeProvider(jest.fn().mockRejectedValue(new Error("AwesomeAPI down")));
    const service = new TrackingFxService(prisma, provider);

    const rate = await service.getUsdToBrlRate();

    expect(rate).toBeNull();
  });
});
