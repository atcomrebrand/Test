import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { FxQuote, TrackingFxRateProvider } from "../domain/tracking-fx.provider";
import { YahooFxProvider } from "../infrastructure/providers/yahoo-fx.provider";
import { ExchangerateFxProvider } from "../infrastructure/providers/exchangerate-fx.provider";
import { CurrencyApiFxProvider } from "../infrastructure/providers/currency-api-fx.provider";

const PAIR = "USDBRL";
/** Short TTL on purpose: this is a single-user app, so there's no real risk of hammering these
 *  free sources — the point of caching at all is just to survive a rapid double-reload/multiple
 *  tabs without firing two outbound requests for the same instant, not to hide genuine movement.
 *  2 minutes means opening the app (or the frontend's own 5min poll) almost always gets a fetch
 *  that reflects the actual current rate, not a half-hour-old snapshot. */
const FX_TTL_MS = 2 * 60 * 1000;

/**
 * The only thing allowed to call TrackingFxRateProvider directly — wraps it in a DB-backed TTL
 * cache (same shape as MarketPriceService in investments) so a slow/unreachable FX source never
 * blocks a page load. getUsdToBrlRate() returns null (never throws) when there's truly no rate to
 * fall back to, so callers can degrade gracefully (skip the conversion) instead of crashing.
 *
 * Also the resilience layer, not just a cache, with four tiers tried in order:
 * 1. AwesomeAPI (primary) — intraday-ish updates, but its free tier sometimes rate-limits a VPS's
 *    IP with a 403/429 (confirmed 2026-07-23: happened on two separate fetches ~18min apart on the
 *    production VPS).
 * 2. Yahoo Finance's USDBRL=X chart ticker — genuinely live (the same number Yahoo's own site
 *    shows), same unofficial endpoint YahooDividendsProvider already uses successfully in
 *    investments. Tried before the daily-snapshot fallbacks below specifically so an AwesomeAPI
 *    rate-limit doesn't sacrifice freshness — without this tier, that 403/429 made the ticker fall
 *    straight to a once-a-day-updated source and look "stuck" a full day behind, which is exactly
 *    the bug this tier fixes.
 * 3 & 4. open.er-api.com and a CDN-hosted static JSON (currency-api) — both only refresh once a
 *    day, so they're last-resort "at least it's a real number" fallbacks, not sources of live data.
 *    Neither exposes a previous-close reference, so getUsdToBrlQuote()'s previousClose comes back
 *    null whenever one of these two ends up serving the request.
 *
 * Only after all four fail does this return whatever's cached, however old.
 */
@Injectable()
export class TrackingFxService {
  private readonly logger = new Logger(TrackingFxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: TrackingFxRateProvider,
    private readonly yahooFallback: YahooFxProvider,
    private readonly exchangerateFallback: ExchangerateFxProvider,
    private readonly cdnFallback: CurrencyApiFxProvider,
  ) {}

  /** Plain rate, for the many callers (Horas' USD job currency conversion) that only ever needed
   *  the number itself. */
  async getUsdToBrlRate(): Promise<number | null> {
    const quote = await this.getUsdToBrlQuote();
    return quote ? quote.rate : null;
  }

  /** Rate + previous close, for the Home ticker's rising/falling indicator. Same cache row and
   *  fetch/fallback chain as getUsdToBrlRate() — this doesn't cost a second round of requests. */
  async getUsdToBrlQuote(): Promise<FxQuote | null> {
    const cached = await this.prisma.trackingFxRateCache.findUnique({ where: { pair: PAIR } });
    const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < FX_TTL_MS;
    if (isFresh) return { rate: Number(cached.rate), previousClose: cached.previousClose ? Number(cached.previousClose) : null };

    const tiers: { name: string; provider: TrackingFxRateProvider }[] = [
      { name: "principal (AwesomeAPI)", provider: this.provider },
      { name: "Yahoo Finance", provider: this.yahooFallback },
      { name: "open.er-api.com", provider: this.exchangerateFallback },
      { name: "CDN (currency-api)", provider: this.cdnFallback },
    ];

    for (const [index, tier] of tiers.entries()) {
      try {
        return await this.fetchAndCache(tier.provider);
      } catch (err) {
        const isLast = index === tiers.length - 1;
        this.logger.warn(
          `Falha ao buscar cotação USD/BRL na fonte ${tier.name}${isLast ? "" : ", tentando a próxima"}: ${(err as Error).message}`,
        );
      }
    }

    return cached ? { rate: Number(cached.rate), previousClose: cached.previousClose ? Number(cached.previousClose) : null } : null;
  }

  private async fetchAndCache(provider: TrackingFxRateProvider): Promise<FxQuote> {
    const quote = await provider.fetchUsdToBrl();
    await this.prisma.trackingFxRateCache.upsert({
      where: { pair: PAIR },
      create: { pair: PAIR, rate: quote.rate, previousClose: quote.previousClose },
      update: { rate: quote.rate, previousClose: quote.previousClose, fetchedAt: new Date() },
    });
    return quote;
  }
}
