/**
 * Pure parser for one line of B3's public COTAHIST "Séries Históricas" file — a fixed-width,
 * 245-byte-per-record format covering every instrument traded on B3 since 1986, published at
 * https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/
 * (layout unchanged since the mid-1990s; documented in B3's "SeriesHistoricas_Layout.pdf").
 *
 * Only the type "01" quote records matter here — the file also has a "00" header and "99"
 * trailer line, both shorter than 245 chars and filtered out by the length/type checks below.
 * Column positions (0-indexed half-open ranges) per the official layout:
 *
 *   TIPREG  [0,2)    tipo de registro ("01" = cotação)
 *   DATA    [2,10)   data do pregão, AAAAMMDD
 *   CODBDI  [10,12)  código BDI
 *   CODNEG  [12,24)  código de negociação (ticker)
 *   TPMERC  [24,27)  tipo de mercado — "010" é o único que interessa aqui (ver isSpotMarketQuote)
 *   ...(nome, espécie, prazo, moeda — não usados)...
 *   PREULT  [108,121) preço de fechamento ("último"), inteiro com 2 casas decimais implícitas
 *   ...(demais campos — ofertas, negócios, volume, opções, ISIN — não usados)...
 */

export interface CotahistQuoteRecord {
  /** ISO date (YYYY-MM-DD) — the trading session this record belongs to. */
  tradeDate: string;
  /** Trading ticker (CODNEG), e.g. "PETR4". */
  ticker: string;
  /** Raw 3-digit market-type code (TPMERC) — see isSpotMarketQuote(). */
  marketType: string;
  /** Closing price for the session, in BRL. */
  closePrice: number;
}

const RECORD_LENGTH = 245;
const RECORD_TYPE_QUOTE = "01";
/** The regular spot ("à vista") market — the one price everyone means by "the asset's price".
 *  Everything else in COTAHIST (012/013 exercício de opções, 017 leilão, 020 fracionário, 030
 *  termo, 050/060 futuro, 070/080 opções) is a derivative or a different trading mode, and is
 *  deliberately excluded so this dataset stays just closing prices, not derivatives noise. */
const SPOT_MARKET_TYPE = "010";

/** COTAHIST price fields are stored as plain digit strings with 2 implied decimal places (no
 *  decimal point) — e.g. "0000000003015" means 30.15. */
function parseImpliedDecimal(raw: string): number {
  return Number.parseInt(raw, 10) / 100;
}

function toIsoDate(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** Parses one line of a COTAHIST file. Returns null for header/trailer lines, malformed lines,
 *  or anything that fails basic structural sanity checks (non-numeric date/price, empty ticker,
 *  non-positive price) — callers should skip nulls rather than treat them as errors, since a
 *  handful of header/trailer/malformed lines per file is expected, not exceptional. */
export function parseCotahistLine(line: string): CotahistQuoteRecord | null {
  if (line.length < RECORD_LENGTH) return null;
  if (line.slice(0, 2) !== RECORD_TYPE_QUOTE) return null;

  const dateRaw = line.slice(2, 10);
  const ticker = line.slice(12, 24).trim();
  const marketType = line.slice(24, 27);
  const closeRaw = line.slice(108, 121);

  if (!/^\d{8}$/.test(dateRaw)) return null;
  if (!ticker) return null;
  if (!/^\d+$/.test(closeRaw)) return null;

  const closePrice = parseImpliedDecimal(closeRaw);
  if (!Number.isFinite(closePrice) || closePrice <= 0) return null;

  return { tradeDate: toIsoDate(dateRaw), ticker, marketType, closePrice };
}

/** Keeps only the regular spot-market session close — see the SPOT_MARKET_TYPE comment above for
 *  why every other market type is excluded. */
export function isSpotMarketQuote(record: CotahistQuoteRecord): boolean {
  return record.marketType === SPOT_MARKET_TYPE;
}
