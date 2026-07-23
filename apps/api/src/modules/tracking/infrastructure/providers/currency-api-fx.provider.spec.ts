import { CurrencyApiFxProvider } from "./currency-api-fx.provider";

describe("CurrencyApiFxProvider.fetchUsdToBrl", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches from the jsdelivr CDN", async () => {
    global.fetch = jest.fn(async (url: string) => {
      expect(url).toContain("cdn.jsdelivr.net");
      return { ok: true, json: async () => ({ date: "2026-07-23", usd: { brl: 5.43 } }) } as any;
    }) as any;

    const provider = new CurrencyApiFxProvider();
    await expect(provider.fetchUsdToBrl()).resolves.toBe(5.43);
  });

  it("falls back to the Cloudflare Pages mirror when jsdelivr fails", async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes("jsdelivr")) return { ok: false, status: 500 } as any;
      expect(url).toContain("pages.dev");
      return { ok: true, json: async () => ({ usd: { brl: 5.6 } }) } as any;
    }) as any;

    const provider = new CurrencyApiFxProvider();
    await expect(provider.fetchUsdToBrl()).resolves.toBe(5.6);
  });

  it("throws the original error when both the CDN and its mirror fail", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }) as any) as any;

    const provider = new CurrencyApiFxProvider();
    await expect(provider.fetchUsdToBrl()).rejects.toThrow(/jsdelivr/);
  });
});
