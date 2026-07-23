import { YahooFxProvider } from "./yahoo-fx.provider";

describe("YahooFxProvider.fetchUsdToBrl", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches the live USDBRL=X quote from Yahoo Finance's chart endpoint", async () => {
    global.fetch = jest.fn(async (url: string) => {
      expect(url).toContain("USDBRL=X");
      return { ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 5.11 } }] } }) } as any;
    }) as any;

    const provider = new YahooFxProvider();
    await expect(provider.fetchUsdToBrl()).resolves.toBe(5.11);
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
