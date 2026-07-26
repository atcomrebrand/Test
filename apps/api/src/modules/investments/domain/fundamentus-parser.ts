export interface FundamentusIndicators {
  grossMargin: number | null;
  priceToSales: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  currentRatio: number | null;
  netDebtToEquity: number | null;
  totalStockholderEquity: number | null;
  totalLiabilities: number | null;
  /** Lucro Líquido, trailing-twelve-months column — a fallback source for the checklist's
   *  "profitable recently" question when BRAPI's netIncomeToCommon isn't available either. */
  netIncomeTtm: number | null;
  /** P/L, LPA, P/VP, VPA, Div. Yield — BRAPI already supplies these too, but its free plan 403s
   *  for every ticker outside a small "sample" set (confirmed for BBAS3, 2026-07-26), so these back
   *  up basic indicators that used to be assumed always-available, not just the advanced ones. */
  peRatio: number | null;
  eps: number | null;
  priceToBook: number | null;
  bookValuePerShare: number | null;
  dividendYield: number | null;
}

function parsePtBrNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace("%", "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Every field label on Fundamentus's detalhes.php page is rendered as "?Label" — the "?" is the
 *  inline tooltip icon sharing the same cell as the label text — immediately followed by its value
 *  in the next <td>, a pattern confirmed to hold across every section of the page (oscilações,
 *  indicadores, balanço, DRE). Matching by label text instead of column position means a reordered
 *  table returns null for the field that moved instead of silently reading the wrong number. Keeps
 *  the FIRST value seen for a repeated label — "Lucro Líquido" appears twice (TTM, then last
 *  quarter), and the TTM column comes first in document order. */
function pairLabelsWithValues(cells: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < cells.length - 1; i++) {
    const cell = cells[i];
    if (!cell.startsWith("?")) continue;
    const label = cell.slice(1).trim();
    if (!map.has(label)) map.set(label, cells[i + 1]);
  }
  return map;
}

/** Confirmed against a live fetch of detalhes.php?papel=PETR4 (2026-07-26) — see
 *  FundamentusProvider for the fetch side (including the Latin-1 decoding this page needs). Stocks
 *  only; FIIs live under a different, unverified page on Fundamentus, so this is never invoked for
 *  that asset class. The page is a same-day snapshot (TTM net income + latest quarter only, no
 *  multi-year/quarter series), so it can't supply the annual/quarterly net-income history the
 *  checklist's "nunca deu prejuízo"/"lucro em 20 trimestres" items need — those stay "Sem dados"
 *  regardless of this addition. returnOnAssets and totalLiabilities aren't direct fields on the
 *  page; they're derived (ROA = Lucro Líquido TTM ÷ Ativo; liabilities = Ativo − Patrim. Líq, the
 *  balance-sheet identity Assets = Liabilities + Equity, not a guess). */
export function parseFundamentusIndicators(html: string): FundamentusIndicators {
  const cells = Array.from(html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), (m) => m[1].replace(/<[^>]+>/g, "").trim());
  const labeled = pairLabelsWithValues(cells);

  const totalAssets = parsePtBrNumber(labeled.get("Ativo"));
  const totalStockholderEquity = parsePtBrNumber(labeled.get("Patrim. Líq"));
  const netIncomeTtm = parsePtBrNumber(labeled.get("Lucro Líquido"));

  return {
    grossMargin: parsePtBrNumber(labeled.get("Marg. Bruta")),
    priceToSales: parsePtBrNumber(labeled.get("PSR")),
    returnOnEquity: parsePtBrNumber(labeled.get("ROE")),
    returnOnAssets: netIncomeTtm !== null && totalAssets !== null && totalAssets !== 0 ? (netIncomeTtm / totalAssets) * 100 : null,
    currentRatio: parsePtBrNumber(labeled.get("Liquidez Corr")),
    netDebtToEquity: parsePtBrNumber(labeled.get("Dív Líq / Patrim")),
    totalStockholderEquity,
    totalLiabilities: totalAssets !== null && totalStockholderEquity !== null ? totalAssets - totalStockholderEquity : null,
    netIncomeTtm,
    peRatio: parsePtBrNumber(labeled.get("P/L")),
    eps: parsePtBrNumber(labeled.get("LPA")),
    priceToBook: parsePtBrNumber(labeled.get("P/VP")),
    bookValuePerShare: parsePtBrNumber(labeled.get("VPA")),
    dividendYield: parsePtBrNumber(labeled.get("Div. Yield")),
  };
}
