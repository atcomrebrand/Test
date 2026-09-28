import { YahooFxProvider } from "./yahoo-fx.provider";

describe("YahooFxProvider.fetchUsdToBrl", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches the live USDBRL=X quote and previous close from Yahoo Finance's chart endpoint", async () => {
    global.fetch = jest.fn(async (url: string) => {
      expect(url).toContain("USDBRL=X");
      return {
        ok: true,
        json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 5.11, chartPreviousClose: 5.09 } }] } }),
      } as any;
    }) as any;

    const provider = new YahooFxProvider();
    await expect(provider.fetchUsdToBrl()).resolves.toEqual({ rate: 5.11, previousClose: 5.09 });
  });

  it("falls back to null previousClose when Yahoo's meta doesn't include one", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 5.11 } }] } }) }) as any) as any;

    const provider = new YahooFxProvider();
    await expect(provider.fetchUsdToBrl()).resolves.toEqual({ rate: 5.11, previousClose: null });
  });

  it("throws when Yahoo returns an error payload", async () => {
    global.fetch = jest.fn(
      async () => ({ ok: true, json: async () => ({ chart: { error: { code: "Not Found", description: "No data" } } }) }) as any,
    ) as any;

    const provider = new YahooFxProvider();
    await expect(provider.fetchUsdToBrl()).rejects.toThrow(/No data/);
  });

  it("throws when the HTTP request itself fails", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }) as any) as any;

    const provider = new YahooFxProvider();
    await expect(provider.fetchUsdToBrl()).rejects.toThrow(/503/);
  });
});
