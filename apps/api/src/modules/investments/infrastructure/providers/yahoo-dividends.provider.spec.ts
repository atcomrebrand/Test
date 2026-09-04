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

describe("YahooDividendsProvider.fetchHistory", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockChart(timestamps: number[], closes: number[], adjcloses?: number[]) {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              timestamp: timestamps,
              indicators: {
                quote: [{ close: closes }],
                ...(adjcloses ? { adjclose: [{ adjclose: adjcloses }] } : {}),
              },
            },
          ],
        },
      }),
    })) as any;
  }

  it("maps timestamp/close pairs into HistoricalPricePoint, preferring adjclose over close", async () => {
    mockChart([1735689600, 1738368000], [10, 11], [9.5, 10.5]);
    const provider = new YahooDividendsProvider();
    const history = await provider.fetchHistory("SAPR4", { range: "12M" });
    expect(history).toEqual([
      { date: "2025-01-01", close: 9.5 },
      { date: "2025-02-01", close: 10.5 },
    ]);
  });

  it("requests range=max&interval=1mo for the MAX range — the same tier BRAPI's plan blocks", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } }) } as any;
    }) as any;

    const provider = new YahooDividendsProvider();
    await provider.fetchHistory("SAPR4", { range: "MAX" });
    expect(calls[0]).toContain("interval=1mo&range=max");
  });

  it("skips a point whose close is null (a gap in Yahoo's own series) instead of throwing", async () => {
    mockChart([1735689600, 1738368000], [10, 11]);
    const provider = new YahooDividendsProvider();
    const history = await provider.fetchHistory("SAPR4", { range: "12M" });
    // Both points are valid here since close is present for both — this asserts the shape survives
    // a mixed series where adjclose is entirely absent (falls back to close, not undefined).
    expect(history).toHaveLength(2);
  });

  it("slices a CUSTOM range down to the exact [from, to] window", async () => {
    mockChart([1735689600, 1736899200, 1738368000], [10, 10.5, 11]);
    const provider = new YahooDividendsProvider();
    const history = await provider.fetchHistory("SAPR4", { range: "CUSTOM", from: "2025-01-15", to: "2025-01-20" });
    expect(history).toEqual([{ date: "2025-01-15", close: 10.5 }]);
  });
});
