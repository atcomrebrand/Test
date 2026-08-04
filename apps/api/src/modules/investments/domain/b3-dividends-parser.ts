import { DividendEvent, DividendType } from "./market-data.provider";

/** B3's cash-dividends listing is per COMPANY, with one row per share class — the ticker's numeric
 *  suffix says which class the user actually holds, and rows for the other classes must be
 *  filtered out (ON and PN rates are often equal, but not always — Klabin, Eletrobras). A suffix
 *  outside this table (fractional "F" tickers are normalized before reaching here) returns null
 *  and the caller treats the ticker as unsupported by this source. */
const STOCK_TYPE_BY_SUFFIX: Record<string, string> = { "3": "ON", "4": "PN", "5": "PNA", "6": "PNB", "7": "PNC", "8": "PND", "11": "UNT" };

export function b3StockTypeForTicker(ticker: string): { root: string; stockType: string } | null {
  const match = ticker.toUpperCase().match(/^([A-Z]{4})(\d{1,2})$/);
  if (!match) return null;
  const stockType = STOCK_TYPE_BY_SUFFIX[match[2]];
  return stockType ? { root: match[1], stockType } : null;
}

/** B3's proxy serves numbers as pt-BR strings ("0,08770722") — but tolerate plain numbers too,
 *  since an API shape this codebase can't re-verify live shouldn't break on the lenient case. */
function parseB3Number(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseB3Date(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function mapType(raw: unknown): DividendType {
  const upper = typeof raw === "string" ? raw.toUpperCase() : "";
  if (upper.includes("JRS") || upper.includes("JCP") || upper.includes("JUROS")) return "JCP";
  if (upper.includes("DIVIDENDO") || upper.includes("RENDIMENTO")) return "DIVIDENDO";
  return "OUTRO";
}

/** Picks the company whose issuingCompany code equals the ticker root (ITSA4 → "ITSA") out of
 *  GetInitialCompanies results — the search is fuzzy on B3's side, so an exact-code match is
 *  required rather than trusting result order. Returns the tradingName the dividends call needs. */
export function extractB3TradingName(payload: unknown, tickerRoot: string): string | null {
  const results = (payload as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return null;
  for (const item of results) {
    const company = item as { issuingCompany?: unknown; tradingName?: unknown };
    if (typeof company.issuingCompany === "string" && company.issuingCompany.toUpperCase() === tickerRoot.toUpperCase()) {
      return typeof company.tradingName === "string" && company.tradingName.trim() !== "" ? company.tradingName.trim() : null;
    }
  }
  return null;
}

/**
 * Parses B3's GetListedCashDividends payload into the shared DividendEvent shape, keeping only the
 * rows for the ticker's own share class. Field semantics: lastDatePriorEx is the last day holding
 * the stock still earns the payment — exactly this app's "data-com"/exDate convention — and the
 * listing carries NO payment date (companies announce that separately), so paymentDate is null and
 * consumers fall back to exDate for display/grouping, same as Yahoo-sourced events already do.
 * rate is valueCash normalized by quotedPerShares (per-1000-share quotes on older entries).
 */
export function parseB3CashDividends(payload: unknown, ticker: string): DividendEvent[] {
  const typed = b3StockTypeForTicker(ticker);
  if (!typed) return [];

  const results = (payload as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];

  const events: DividendEvent[] = [];
  for (const item of results) {
    const row = item as Record<string, unknown>;
    const stockType = typeof row.typeStock === "string" ? row.typeStock.trim().toUpperCase() : "";
    if (stockType !== typed.stockType) continue;

    const exDate = parseB3Date(row.lastDatePriorEx);
    const valueCash = parseB3Number(row.valueCash);
    if (!exDate || valueCash === null || valueCash <= 0) continue;

    const quotedPerShares = parseB3Number(row.quotedPerShares);
    const rate = quotedPerShares !== null && quotedPerShares > 0 ? valueCash / quotedPerShares : valueCash;

    events.push({
      ticker: ticker.toUpperCase(),
      type: mapType(row.corporateAction),
      rate,
      exDate,
      paymentDate: null,
      relatedTo: null,
    });
  }
  return events;
}
