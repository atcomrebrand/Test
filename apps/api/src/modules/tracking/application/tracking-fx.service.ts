import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxRateProvider } from "../domain/tracking-fx.provider";
import { ExchangerateFxProvider } from "../infrastructure/providers/exchangerate-fx.provider";

const PAIR = "USDBRL";
/** Exchange rates don't need to feel second-by-second live — a 30min TTL keeps the "cotação de
 *  hoje" numbers fresh enough without hammering the free-tier AwesomeAPI on every dashboard load. */
const FX_TTL_MS = 30 * 60 * 1000;

/**
 * The only thing allowed to call TrackingFxRateProvider directly — wraps it in a DB-backed TTL
 * cache (same shape as MarketPriceService in investments) so a slow/unreachable FX source never
 * blocks a page load. Returns null (never throws) when there's truly no rate to fall back to, so
 * callers can degrade gracefully (skip the conversion) instead of crashing.
 *
 * Also the resilience layer, not just a cache: free-tier FX APIs like AwesomeAPI sometimes block
 * requests from cloud/datacenter IP ranges with a 403 — when that happens this retries via a
 * second, independent provider before giving up, same pattern as DividendsCacheService's Yahoo
 * Finance fallback in investments.
 */
@Injectable()
export class TrackingFxService {
  private readonly logger = new Logger(TrackingFxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: TrackingFxRateProvider,
    private readonly fallbackProvider: ExchangerateFxProvider,
  ) {}

  async getUsdToBrlRate(): Promise<number | null> {
    const cached = await this.prisma.trackingFxRateCache.findUnique({ where: { pair: PAIR } });
    const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < FX_TTL_MS;
    if (isFresh) return Number(cached.rate);

    try {
      return await this.fetchAndCache(this.provider);
    } catch (err) {
      this.logger.warn(`Falha ao buscar cotação USD/BRL na fonte principal, tentando alternativa: ${(err as Error).message}`);
      try {
        return await this.fetchAndCache(this.fallbackProvider);
      } catch (fallbackErr) {
        this.logger.warn(`Falha ao buscar cotação USD/BRL na fonte alternativa: ${(fallbackErr as Error).message}`);
        return cached ? Number(cached.rate) : null;
      }
    }
  }

  private async fetchAndCache(provider: TrackingFxRateProvider): Promise<number> {
    const rate = await provider.fetchUsdToBrl();
    await this.prisma.trackingFxRateCache.upsert({
      where: { pair: PAIR },
      create: { pair: PAIR, rate },
      update: { rate, fetchedAt: new Date() },
    });
    return rate;
  }
}
