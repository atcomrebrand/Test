import { b3StockTypeForTicker, extractB3TradingName, parseB3CashDividends } from "./b3-dividends-parser";

const COMPANIES_PAYLOAD = {
  page: { pageNumber: 1, totalRecords: 2 },
  results: [
    { codeCVM: 99999, issuingCompany: "ITSB", companyName: "OUTRA S.A.", tradingName: "OUTRA" },
    { codeCVM: 14109, issuingCompany: "ITSA", companyName: "ITAUSA S.A.", tradingName: "ITAUSA" },
  ],
};

const DIVIDENDS_PAYLOAD = {
  page: { pageNumber: 1 },
  results: [
    {
      typeStock: "PN",
      dateApproval: "24/02/2026",
      valueCash: "0,25000000",
      ratio: "1,00000000",
      corporateAction: "DIVIDENDO",
      lastDatePriorEx: "02/06/2026",
      quotedPerShares: "1,00000000",
    },
    {
      typeStock: "ON",
      dateApproval: "24/02/2026",
      valueCash: "0,30000000",
      ratio: "1,00000000",
      corporateAction: "DIVIDENDO",
      lastDatePriorEx: "02/06/2026",
      quotedPerShares: "1,00000000",
    },
    {
      typeStock: "PN",
      dateApproval: "10/12/2025",
      valueCash: "0,09200000",
      ratio: "1,00000000",
      corporateAction: "JRS CAP PROPRIO",
      lastDatePriorEx: "15/05/2026",
      quotedPerShares: "1,00000000",
    },
    {
      typeStock: "PN",
      dateApproval: "10/03/1998",
      valueCash: "50,00000000",
      ratio: "1,00000000",
      corporateAction: "DIVIDENDO",
      lastDatePriorEx: "10/03/1998",
      quotedPerShares: "1.000,00000000",
    },
  ],
};

describe("b3StockTypeForTicker", () => {
  it("maps the numeric suffix to B3's share-class code", () => {
    expect(b3StockTypeForTicker("ITSA4")).toEqual({ root: "ITSA", stockType: "PN" });
    expect(b3StockTypeForTicker("BBAS3")).toEqual({ root: "BBAS", stockType: "ON" });
    expect(b3StockTypeForTicker("TAEE11")).toEqual({ root: "TAEE", stockType: "UNT" });
  });

  it("returns null for suffixes/shapes it doesn't know instead of guessing", () => {
    expect(b3StockTypeForTicker("ITSA9")).toBeNull();
    expect(b3StockTypeForTicker("BTC")).toBeNull();
  });
});

describe("extractB3TradingName", () => {
  it("matches by exact issuingCompany code, not result order (B3's search is fuzzy)", () => {
    expect(extractB3TradingName(COMPANIES_PAYLOAD, "ITSA")).toBe("ITAUSA");
  });

  it("returns null when no result carries the exact code", () => {
    expect(extractB3TradingName(COMPANIES_PAYLOAD, "PETR")).toBeNull();
    expect(extractB3TradingName({ results: [] }, "ITSA")).toBeNull();
    expect(extractB3TradingName(null, "ITSA")).toBeNull();
  });
});

describe("parseB3CashDividends", () => {
  it("keeps only the ticker's own share class and maps fields to DividendEvent", () => {
    const events = parseB3CashDividends(DIVIDENDS_PAYLOAD, "ITSA4");
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({
      ticker: "ITSA4",
      type: "DIVIDENDO",
      rate: 0.25,
      exDate: "2026-06-02",
      paymentDate: null,
      relatedTo: null,
    });
  });

  it("returns the ON rows for the 3-suffixed ticker of the same company", () => {
    const events = parseB3CashDividends(DIVIDENDS_PAYLOAD, "ITSA3");
    expect(events).toHaveLength(1);
    expect(events[0].rate).toBe(0.3);
  });

  it('maps "JRS CAP PROPRIO" to JCP', () => {
    const events = parseB3CashDividends(DIVIDENDS_PAYLOAD, "ITSA4");
    expect(events[1].type).toBe("JCP");
  });

  it("normalizes valueCash by quotedPerShares (older per-1000-share quotes)", () => {
    const events = parseB3CashDividends(DIVIDENDS_PAYLOAD, "ITSA4");
    expect(events[2].rate).toBeCloseTo(0.05, 10);
  });

  it("returns [] for malformed payloads or unsupported tickers instead of throwing", () => {
    expect(parseB3CashDividends(null, "ITSA4")).toEqual([]);
    expect(parseB3CashDividends({ nope: true }, "ITSA4")).toEqual([]);
    expect(parseB3CashDividends(DIVIDENDS_PAYLOAD, "ITSA9")).toEqual([]);
  });

  it("tolerates numeric (non-string) values in case the proxy serves plain JSON numbers", () => {
    const payload = { results: [{ typeStock: "PN", valueCash: 0.25, quotedPerShares: 1, corporateAction: "DIVIDENDO", lastDatePriorEx: "02/06/2026" }] };
    const events = parseB3CashDividends(payload, "ITSA4");
    expect(events).toHaveLength(1);
    expect(events[0].rate).toBe(0.25);
  });
});
