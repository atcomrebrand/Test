import { DividendEvent, DividendType } from "./market-data.provider";

/** Fundamentus renders proventos as a plain server-side HTML table (id="resultado"), but the
 *  column set differs between the stock page (Data | Valor | Tipo | Data de Pagamento | Por
 *  quantas ações) and the FII page (Última Data Com | Tipo | Data de Pagamento | Valor). Columns
 *  are therefore resolved by header text, never by position — a variant this mapping doesn't
 *  recognize yields zero events, which the caller treats as "source has nothing" and falls through
 *  to the next dividend source rather than mis-reading a column. */
interface ColumnIndexes {
  exDate: number;
  value: number;
  type: number;
  paymentDate: number;
  /** Fundamentus quotes older stock payouts per N shares (e.g. per 1000) — value must be divided
   *  by this to get the per-share rate the rest of the app works with. Absent on the FII table. */
  perShares: number | null;
}

function resolveColumns(headers: string[]): ColumnIndexes | null {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (pred: (h: string) => boolean) => lower.findIndex(pred);

  const exDate = find((h) => h.includes("data com") || h === "data");
  const value = find((h) => h.startsWith("valor"));
  const type = find((h) => h === "tipo");
  const paymentDate = find((h) => h.includes("pagamento"));
  const perShares = find((h) => h.includes("quantas"));

  if (exDate < 0 || value < 0 || type < 0) return null;
  return { exDate, value, type, paymentDate, perShares: perShares >= 0 ? perShares : null };
}

/** "31/12/2025" → "2025-12-31"; anything else (empty, "-") → null. */
function parsePtBrDate(raw: string | undefined): string | null {
  const match = raw?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parsePtBrNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** JCP appears as "JRS CAP PROPRIO" on stock pages; FII payouts come as "RENDIMENTO", which is
 *  the FII-world equivalent of a dividend (and what the rest of the app already calls DIVIDENDO
 *  for FIIs via BRAPI). Amortização and anything unrecognized map to OUTRO instead of being
 *  guessed into a bucket that would inflate dividend statistics. */
function mapType(raw: string): DividendType {
  const upper = raw.toUpperCase();
  if (upper.includes("JRS") || upper.includes("JCP") || upper.includes("JUROS")) return "JCP";
  if (upper.includes("DIVIDENDO") || upper.includes("RENDIMENTO")) return "DIVIDENDO";
  return "OUTRO";
}

function stripTags(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Parses Fundamentus's proventos.php / fii_proventos.php table into the shared DividendEvent
 *  shape. Pure and fail-soft: malformed rows are skipped individually, an unrecognizable table
 *  yields [], and nothing throws — the fetch layer decides what a hard failure means. */
export function parseFundamentusProventos(html: string, ticker: string): DividendEvent[] {
  const tableMatch = html.match(/<table[^>]*id="resultado"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const table = tableMatch[1];

  const rows = Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi), (m) => m[1]);
  if (rows.length < 2) return [];

  const headers = Array.from(rows[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi), (m) => stripTags(m[1]));
  const columns = resolveColumns(headers);
  if (!columns) return [];

  const events: DividendEvent[] = [];
  for (const row of rows.slice(1)) {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (m) => stripTags(m[1]));
    if (cells.length < headers.length) continue;

    const exDate = parsePtBrDate(cells[columns.exDate]);
    const rawValue = parsePtBrNumber(cells[columns.value]);
    if (!exDate || rawValue === null || rawValue <= 0) continue;

    const perShares = columns.perShares !== null ? parsePtBrNumber(cells[columns.perShares]) : null;
    const rate = perShares !== null && perShares > 0 ? rawValue / perShares : rawValue;

    events.push({
      ticker,
      type: mapType(cells[columns.type] ?? ""),
      rate,
      exDate,
      paymentDate: columns.paymentDate >= 0 ? parsePtBrDate(cells[columns.paymentDate]) : null,
      relatedTo: null,
    });
  }
  return events;
}
