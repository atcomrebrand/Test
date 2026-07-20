import { Injectable } from "@nestjs/common";
import { AssetRepository } from "../domain/asset.repository";
import { DividendEvent } from "../domain/market-data.provider";
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
 *  literally every ticker in existence). */
const MARKET_CALENDAR_TICKERS = [
  "ITSA4", "BBAS3", "TAEE11", "VALE3", "PETR4", "PETR3", "BBDC4", "ITUB4", "VIVT3", "CPLE6",
  "EGIE3", "CMIG4", "TRPL4", "CSMG3", "BBSE3",
  "KNRI11", "HGLG11", "MXRF11", "XPML11", "VISC11", "BCFF11", "HGRU11", "VILG11",
];

/** Caps how many owned tickers get their own dividend lookup — a portfolio with 40 assets
 *  shouldn't fire 40 requests every time the calendar loads. */
const MAX_PORTFOLIO_TICKERS = 15;

@Injectable()
export class DividendsService {
  constructor(
    private readonly dividendsCache: DividendsCacheService,
    private readonly assets: AssetRepository,
  ) {}

  async getMarketCalendar(): Promise<DividendCalendarEntry[]> {
    const results = await Promise.all(
      MARKET_CALENDAR_TICKERS.map(async (ticker) => {
        const events = await this.dividendsCache.get(ticker);
        return events.map((event) => ({ ...event, name: null, quantityHeld: null, estimatedAmount: null }));
      }),
    );
    return sortByDateDesc(results.flat());
  }

  /** Only stocks/FIIs the user actually owns (quantity > 0) — crypto has no dividend concept. */
  async getPortfolioCalendar(userId: string): Promise<DividendCalendarEntry[]> {
    const owned = await this.assets.findAllByUser(userId);
    const eligible = owned.filter((a) => a.class === "STOCK" || a.class === "FII").slice(0, MAX_PORTFOLIO_TICKERS);
    if (eligible.length === 0) return [];

    const results = await Promise.all(
      eligible.map(async (asset) => {
        const transactions = await this.assets.listTransactions(asset.id);
        const position = calculatePosition(
          transactions.map((t) => ({ type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate })),
        );
        if (position.quantity <= 0) return [];

        const events = await this.dividendsCache.get(asset.ticker);
        return events.map((event) => ({
          ...event,
          name: asset.name,
          quantityHeld: position.quantity,
          estimatedAmount: event.rate * position.quantity,
        }));
      }),
    );

    return sortByDateDesc(results.flat());
  }
}

function sortByDateDesc(entries: DividendCalendarEntry[]): DividendCalendarEntry[] {
  return entries.sort((a, b) => {
    const dateA = a.paymentDate ?? a.exDate ?? "";
    const dateB = b.paymentDate ?? b.exDate ?? "";
    return dateB.localeCompare(dateA);
  });
}
