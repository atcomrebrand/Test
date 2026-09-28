import { buildAssetTickerItems, TickerAssetInput } from "./asset-ticker";

function ativo(over: Partial<TickerAssetInput> = {}): TickerAssetInput {
  return { ticker: "PETR4", assetClass: "STOCK", quantity: 100, price: 32.5, previousClose: 32, ...over };
}

describe("buildAssetTickerItems", () => {
  it("mostra ticker, emoji da classe e cotação — a mesma anatomia do item do dólar", () => {
    expect(buildAssetTickerItems([ativo()])).toEqual([
      { symbol: "PETR4", label: "PETR4", flag: "📈", rate: 32.5, previousClose: 32 },
    ]);
  });

  it("cada classe tem seu emoji no lugar da bandeira", () => {
    const flags = buildAssetTickerItems([
      ativo({ ticker: "HGLG11", assetClass: "FII" }),
      ativo({ ticker: "BTC", assetClass: "CRYPTO" }),
    ]).map((i) => i.flag);
    expect(flags).toEqual(["🏢", "🪙"]);
  });

  it("ativo vendido não fica rolando na Home pra sempre", () => {
    expect(buildAssetTickerItems([ativo({ quantity: 0 })])).toEqual([]);
    expect(buildAssetTickerItems([ativo({ quantity: -5 })])).toEqual([]);
  });

  it("sem cotação o ativo sai — provedor fora do ar não pode virar parede de 'indisponível'", () => {
    expect(buildAssetTickerItems([ativo({ price: null })])).toEqual([]);
    expect(buildAssetTickerItems([ativo({ price: 0 })])).toEqual([]);
    expect(buildAssetTickerItems([ativo({ price: Number.NaN })])).toEqual([]);
  });

  it("maior posição primeiro, não ordem alfabética", () => {
    const ordem = buildAssetTickerItems([
      ativo({ ticker: "ABEV3", quantity: 10, price: 12 }),
      ativo({ ticker: "PETR4", quantity: 100, price: 32.5 }),
      ativo({ ticker: "VALE3", quantity: 80, price: 58 }),
    ]).map((i) => i.symbol);
    expect(ordem).toEqual(["VALE3", "PETR4", "ABEV3"]);
  });

  it("sem fechamento anterior o item existe, só não tem seta", () => {
    const [item] = buildAssetTickerItems([ativo({ previousClose: null })]);
    expect(item.rate).toBe(32.5);
    expect(item.previousClose).toBeNull();
  });

  it("carteira vazia não quebra", () => {
    expect(buildAssetTickerItems([])).toEqual([]);
  });
});
