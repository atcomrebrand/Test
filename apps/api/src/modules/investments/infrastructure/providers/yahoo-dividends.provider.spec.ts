import { YahooDividendsProvider } from "./yahoo-dividends.provider";

describe("YahooDividendsProvider.fetchDividends", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the real captured BBAS3.SA response shape (chart.result[0].events.dividends)", async () => {
    const calls: { url: string; init: any }[] = [];
    global.fetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                events: {
                  dividends: {
                    "1471957200": { amount: 0.069983, date: 1471957200 },
                    "1473771600": { amount: 0.063326, date: 1473771600 },
                  },
                },
              },
            ],
          },
        }),
      } as any;
    }) as any;

    const provider = new YahooDividendsProvider();
    const events = await provider.fetchDividends("BBAS3");

    expect(calls[0].url).toBe("https://query1.finance.yahoo.com/v8/finance/chart/BBAS3.SA?events=div&interval=1d&range=10y");
    expect(calls[0].init.headers["User-Agent"]).toContain("Mozilla");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      ticker: "BBAS3",
      type: "OUTRO",
      rate: 0.069983,
      exDate: "2016-08-23",
      paymentDate: null,
      relatedTo: "Fonte: Yahoo Finance",
    });
  });

  it("throws when Yahoo reports an error for the symbol (e.g. wrong/delisted ticker)", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ chart: { result: null, error: { code: "Not Found", description: "No data found" } } }),
    })) as any;

    const provider = new YahooDividendsProvider();
    await expect(provider.fetchDividends("NAOEXISTE")).rejects.toThrow();
  });

  it("treats an empty dividends object as a valid answer (never paid a dividend), not a failure", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ chart: { result: [{ events: {} }] } }),
    })) as any;

    const provider = new YahooDividendsProvider();
    const events = await provider.fetchDividends("XYZW3");
    expect(events).toEqual([]);
  });

  it("falls back to the round-lot ticker for a fractional-lot symbol", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("BBSE3F.SA")) return { ok: false, status: 404 } as any;
      return { ok: true, json: async () => ({ chart: { result: [{ events: { dividends: { "1471957200": { amount: 1, date: 1471957200 } } } }] } }) } as any;
    }) as any;

    const provider = new YahooDividendsProvider();
    const events = await provider.fetchDividends("BBSE3F");

    expect(calls[0]).toContain("BBSE3F.SA");
    expect(calls[1]).toContain("BBSE3.SA");
    expect(events).toHaveLength(1);
    // Labeled with the originally-requested ticker, not the round-lot substitute that actually
    // supplied the data — same convention BrapiProvider uses for its own fractional fallback.
    expect(events[0].ticker).toBe("BBSE3F");
  });
});
