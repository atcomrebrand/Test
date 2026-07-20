import { Injectable } from "@nestjs/common";
import { mapWithConcurrency } from "../../../common/utils/concurrency";
import { AssetRepository } from "../domain/asset.repository";
import { DividendAssetClass, DividendEvent } from "../domain/market-data.provider";
import { calculatePosition } from "../domain/position-calculator";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

export interface DividendCalendarEntry extends DividendEvent {
  name: string | null;
  /** Only set on the portfolio calendar — the user's current position size for this ticker. */
  quantityHeld: number | null;
  /** rate * quantityHeld, only set on the portfolio calendar. */
  estimatedAmount: number | null;
}

/** Curated list of liquid, well-known B3 dividend payers (stocks + FIIs) for the "all assets"
 *  calendar. Fetching dividend data for the entire B3 catalog (400+ tickers) on every request
 *  would be far too slow and would burn through BRAPI's free-tier rate limit — this keeps the
 *  calendar useful and fast while staying honest (the UI labels it as "principais ativos", not
 *  literally every ticker in existence). Each ticker is tagged with its class explicitly rather
 *  than inferred from the "11" suffix — several non-FII "units" (TAEE11) also end in 11, and
 *  BRAPI's dividends endpoint rejects a ticker sent to the wrong one of its two class-specific
 *  routes outright (confirmed 2026-07-20: FIIs get a 400 off /api/v2/stocks/dividends). */
const MARKET_CALENDAR_TICKERS: { ticker: string; class: DividendAssetClass }[] = [
  ...["ITSA4", "BBAS3", "TAEE11", "VALE3", "PETR4", "PETR3", "BBDC4", "ITUB4", "VIVT3", "CPLE6", "EGIE3", "CMIG4", "TRPL4", "CSMG3", "BBSE3"].map(
    (ticker) => ({ ticker, class: "STOCK" as const }),
  ),
  ...["KNRI11", "HGLG11", "MXRF11", "XPML11", "VISC11", "BCFF11", "HGRU11", "VILG11"].map((ticker) => ({ ticker, class: "FII" as const })),
];

/** Bounds how many dividend lookups run at once — a portfolio bulk-imported from a B3 statement
 *  can easily have 20+ stocks/FIIs, and firing one BRAPI request per ticker with no limit risks
 *  the same rate-limit trouble AssetsService.findAll works around for quotes. This only throttles
 *  concurrency, though: every owned ticker still gets checked, none are silently dropped just for
 *  being past some fixed count — a version of this that capped the LIST itself (instead of just
 *  the concurrency) used to make the calendar quietly skip tickers in a 20+ asset portfolio. */
const DIVIDEND_FETCH_CONCURRENCY = 4;

@Injectable()
export class DividendsService {
  constructor(
    private readonly dividendsCache: DividendsCacheService,
    private readonly assets: AssetRepository,
  ) {}

  async getMarketCalendar(): Promise<DividendCalendarEntry[]> {
    const results = await Promise.all(
      MARKET_CALENDAR_TICKERS.map(async ({ ticker, class: assetClass }) => {
        const events = await this.dividendsCache.get(ticker, assetClass);
        return events.map((event) => ({ ...event, name: null, quantityHeld: null, estimatedAmount: null }));
      }),
    );
    return sortByDateDesc(results.flat());
  }

  /** Stocks/FIIs the user owns or has ever owned — crypto has no dividend concept. Each event is
   *  valued against the position actually held on ITS OWN ex-dividend ("data-com") date, not the
   *  position held today: a stock bought after an old payment date shouldn't show that payment as
   *  received, and one bought before but partly sold since should still show the full amount held
   *  back when the entitlement was earned. Same reconstruction B3ImportService's dividend
   *  suggestions already use, just against every fetched event instead of only unmatched ones. */
  async getPortfolioCalendar(userId: string): Promise<DividendCalendarEntry[]> {
    const owned = await this.assets.findAllByUser(userId);
    const eligible = owned.filter((a) => a.class === "STOCK" || a.class === "FII");
    if (eligible.length === 0) return [];

    const results = await mapWithConcurrency(eligible, DIVIDEND_FETCH_CONCURRENCY, async (asset) => {
      const transactions = await this.assets.listTransactions(asset.id);
      const txs = transactions.map((t) => ({ type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate }));

      const events = await this.dividendsCache.get(asset.ticker, asset.class as DividendAssetClass);
      return events
        .map((event): DividendCalendarEntry | null => {
          const positionAsOfDate = event.exDate ?? event.paymentDate;
          if (!positionAsOfDate) return null;

          const heldAsOf = txs.filter((t) => isoDate(t.transactionDate) <= positionAsOfDate);
          const quantityHeld = calculatePosition(heldAsOf).quantity;
          if (quantityHeld <= 0) return null;

          return { ...event, name: asset.name, quantityHeld, estimatedAmount: event.rate * quantityHeld };
        })
        .filter((e): e is DividendCalendarEntry => e !== null);
    });

    return sortByDateDesc(results.flat());
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sortByDateDesc(entries: DividendCalendarEntry[]): DividendCalendarEntry[] {
  return entries.sort((a, b) => {
    const dateA = a.paymentDate ?? a.exDate ?? "";
    const dateB = b.paymentDate ?? b.exDate ?? "";
    return dateB.localeCompare(dateA);
  });
}
