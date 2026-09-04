/** B3 appends "F" to a ticker to mark the fractional-lot market segment (e.g. BBSE3F trades the
 *  same underlying stock as BBSE3, just in odd lots, at its own price — usually close to but not
 *  identical to the round-lot price). Neither BRAPI nor Yahoo Finance price/report corporate
 *  actions for the fractional-specific ticker, so every provider that hits this falls back to the
 *  round-lot ticker as a best-effort substitute. */
const FRACTIONAL_TICKER_PATTERN = /^([A-Z]{4}\d{1,2})F$/;

export function baseTickerFor(ticker: string): string | null {
  return ticker.toUpperCase().match(FRACTIONAL_TICKER_PATTERN)?.[1] ?? null;
}
