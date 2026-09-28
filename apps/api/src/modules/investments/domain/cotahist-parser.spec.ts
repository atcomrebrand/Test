import { isSpotMarketQuote, parseCotahistLine } from "./cotahist-parser";

/** Builds a syntactically valid 245-char COTAHIST record from just the fields the parser reads —
 *  every other column is padded with spaces/zeros of the correct width per the official layout,
 *  so the fixture's total length is always exactly right regardless of manual arithmetic. */
function buildLine(fields: { date: string; ticker: string; marketType: string; closeCents: number }): string {
  const pad = (value: string, width: number) => value.padEnd(width, " ").slice(0, width);
  const zeros = (value: number, width: number) => String(value).padStart(width, "0").slice(-width);

  return [
    "01", // TIPREG
    fields.date.replace(/-/g, ""), // DATA (8)
    "02", // CODBDI
    pad(fields.ticker, 12), // CODNEG
    fields.marketType, // TPMERC (3)
    pad("EMPRESA", 12), // NOMRES
    pad("PN", 10), // ESPECI
    pad("", 3), // PRAZOT
    pad("R$", 4), // MODREF
    zeros(3000, 13), // PREABE
    zeros(3050, 13), // PREMAX
    zeros(2980, 13), // PREMIN
    zeros(3010, 13), // PREMED
    zeros(fields.closeCents, 13), // PREULT
    zeros(3014, 13), // PREOFC
    zeros(3016, 13), // PREOFV
    zeros(100, 5), // TOTNEG
    zeros(1_000_000, 18), // QUATOT
    zeros(30_150_000, 18), // VOLTOT
    zeros(0, 13), // PREEXE
    " ", // INDOPC
    "99991231", // DATVEN
    zeros(1, 7), // FATCOT
    zeros(0, 13), // PTOEXE
    pad("BRPETRACNPR6", 12), // CODISI
    zeros(100, 3), // DISMES
  ].join("");
}

describe("parseCotahistLine", () => {
  it("parses ticker, date and close price from a spot-market record", () => {
    const line = buildLine({ date: "2023-05-15", ticker: "PETR4", marketType: "010", closeCents: 3015 });

    const result = parseCotahistLine(line);

    expect(result).toEqual({ tradeDate: "2023-05-15", ticker: "PETR4", marketType: "010", closePrice: 30.15 });
  });

  it("builds a 245-char fixture (sanity check on the test helper itself)", () => {
    const line = buildLine({ date: "2023-05-15", ticker: "PETR4", marketType: "010", closeCents: 3015 });
    expect(line).toHaveLength(245);
  });

  it("trims trailing spaces off short tickers", () => {
    const line = buildLine({ date: "2023-05-15", ticker: "BBAS3", marketType: "010", closeCents: 5000 });
    expect(parseCotahistLine(line)?.ticker).toBe("BBAS3");
  });

  it("returns null for a header line (type 00)", () => {
    const line = "00" + "0".repeat(243);
    expect(parseCotahistLine(line)).toBeNull();
  });

  it("returns null for a trailer line (type 99)", () => {
    const line = "99" + "0".repeat(243);
    expect(parseCotahistLine(line)).toBeNull();
  });

  it("returns null for a line shorter than 245 chars", () => {
    expect(parseCotahistLine("01 too short")).toBeNull();
  });

  it("returns null when the close price is zero (no trades that session)", () => {
    const line = buildLine({ date: "2023-05-15", ticker: "PETR4", marketType: "010", closeCents: 0 });
    expect(parseCotahistLine(line)).toBeNull();
  });
});

describe("isSpotMarketQuote", () => {
  it("accepts the regular spot market (010)", () => {
    const record = parseCotahistLine(buildLine({ date: "2023-05-15", ticker: "PETR4", marketType: "010", closeCents: 3015 }))!;
    expect(isSpotMarketQuote(record)).toBe(true);
  });

  it.each(["012", "013", "017", "020", "030", "050", "060", "070", "080"])("rejects non-spot market type %s", (marketType) => {
    const record = parseCotahistLine(buildLine({ date: "2023-05-15", ticker: "PETR4W123", marketType, closeCents: 3015 }))!;
    expect(isSpotMarketQuote(record)).toBe(false);
  });
});
