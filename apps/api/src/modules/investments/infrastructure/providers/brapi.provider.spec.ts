import { BrapiProvider } from "./brapi.provider";

describe("BrapiProvider.fetchDividends", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.BRAPI_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BRAPI_TOKEN = originalToken;
  });

  it("routes a STOCK ticker to /api/v2/stocks/dividends and parses cashDividends", async () => {
    process.env.BRAPI_TOKEN = "test-token";
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({
          results: [{ data: { cashDividends: [{ rate: 0.5, paymentDate: "2026-03-15", lastDatePrior: "2026-03-01", relatedTo: null, label: "Dividendo" }] } }],
        }),
      } as any;
    }) as any;

    const provider = new BrapiProvider();
    const events = await provider.fetchDividends("PETR4", "STOCK");

    expect(calls[0]).toContain("/api/v2/stocks/dividends");
    expect(calls[0]).not.toContain("/api/v2/fii/dividends");
    expect(events).toEqual([{ ticker: "PETR4", type: "DIVIDENDO", rate: 0.5, exDate: "2026-03-01", paymentDate: "2026-03-15", relatedTo: null }]);
  });

  it("routes a FII ticker to /api/v2/fii/dividends and parses the flat dividends array", async () => {
    process.env.BRAPI_TOKEN = "test-token";
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({
          dividends: [{ rate: 0.1, paymentDate: "2026-07-14 00:00:00+00", lastDatePrior: "2026-06-30 00:00:00+00", relatedTo: null, label: "RENDIMENTO" }],
        }),
      } as any;
    }) as any;

    const provider = new BrapiProvider();
    const events = await provider.fetchDividends("MXRF11", "FII");

    expect(calls[0]).toContain("/api/v2/fii/dividends");
    expect(calls[0]).not.toContain("/api/v2/stocks/dividends");
    expect(events).toEqual([{ ticker: "MXRF11", type: "OUTRO", rate: 0.1, exDate: "2026-06-30", paymentDate: "2026-07-14", relatedTo: null }]);
  });

  it("falls back to the round-lot ticker on the FII endpoint too, when the exact one fails", async () => {
    process.env.BRAPI_TOKEN = "test-token";
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes("symbols=MXRF11F")) return { ok: false, status: 404 } as any;
      return { ok: true, json: async () => ({ dividends: [{ rate: 0.1, paymentDate: "2026-07-14", lastDatePrior: "2026-06-30", relatedTo: null, label: "RENDIMENTO" }] }) } as any;
    }) as any;

    const provider = new BrapiProvider();
    const events = await provider.fetchDividends("MXRF11F", "FII");

    expect(events).toHaveLength(1);
    expect(events[0].ticker).toBe("MXRF11F");
  });
});
