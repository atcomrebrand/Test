import { ProductPricePoint, summarizeProductPrices, groupPurchaseOccasions } from "./product-price-history";

function point(purchaseDate: string, unitPrice: number, quantity = 1, storeName = "Mercado A"): ProductPricePoint {
  return { purchaseDate, storeName, unitPrice, quantity, totalPrice: Math.round(unitPrice * quantity * 100) / 100 };
}

describe("summarizeProductPrices", () => {
  it("returns null when the product was never bought", () => {
    expect(summarizeProductPrices([])).toBeNull();
  });

  it("reports first/last by date regardless of the order the points arrive in", () => {
    const summary = summarizeProductPrices([point("2026-05-01", 30), point("2026-01-01", 25), point("2026-03-01", 28)])!;
    expect(summary.firstPrice).toBe(25);
    expect(summary.firstDate).toBe("2026-01-01");
    expect(summary.lastPrice).toBe(30);
    expect(summary.lastDate).toBe("2026-05-01");
  });

  it("computes the price change from first to last purchase", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-06-01", 25)])!;
    expect(summary.changePercent).toBeCloseTo(25, 10);
  });

  it("reports a price drop as a negative change", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-06-01", 15)])!;
    expect(summary.changePercent).toBeCloseTo(-25, 10);
  });

  it("has no change to report for a product bought only once", () => {
    expect(summarizeProductPrices([point("2026-01-01", 20)])!.changePercent).toBeNull();
  });

  it("weights the average by quantity, so a big cheap buy outweighs a small expensive one", () => {
    // 5kg at 4,00 (=20,00) and 1kg at 10,00 (=10,00): 30,00 over 6kg = 5,00/kg.
    const summary = summarizeProductPrices([point("2026-01-01", 4, 5), point("2026-02-01", 10, 1)])!;
    expect(summary.averagePrice).toBeCloseTo(5, 10);
    // A naive mean of the unit prices would have said 7,00 — materially wrong.
    expect(summary.averagePrice).not.toBeCloseTo(7, 1);
  });

  it("accumulates spend, quantity and purchase count", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 4, 5), point("2026-02-01", 10, 1)])!;
    expect(summary.timesBought).toBe(2);
    expect(summary.totalSpent).toBeCloseTo(30, 10);
    expect(summary.totalQuantity).toBeCloseTo(6, 10);
  });

  it("tracks the cheapest and most expensive prices seen", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 20), point("2026-02-01", 12), point("2026-03-01", 25)])!;
    expect(summary.minPrice).toBe(12);
    expect(summary.maxPrice).toBe(25);
  });

  it("names the store with the cheapest price on record", () => {
    const summary = summarizeProductPrices([
      point("2026-01-01", 20, 1, "Mercado Caro"),
      point("2026-02-01", 12, 1, "Mercado Barato"),
      point("2026-03-01", 25, 1, "Mercado Caro"),
    ])!;
    expect(summary.cheapestStore).toBe("Mercado Barato");
    expect(summary.cheapestStorePrice).toBe(12);
  });

  it("treats a zero first price as no comparison rather than an infinite increase", () => {
    const summary = summarizeProductPrices([point("2026-01-01", 0), point("2026-06-01", 10)])!;
    expect(summary.changePercent).toBeNull();
  });

  it("does not divide by zero when every purchase had zero quantity", () => {
    const summary = summarizeProductPrices([{ purchaseDate: "2026-01-01", storeName: "A", unitPrice: 0, quantity: 0, totalPrice: 0 }])!;
    expect(summary.averagePrice).toBe(0);
  });
});

describe("groupPurchaseOccasions — uma compra é uma ida ao mercado, não uma linha de nota", () => {
  function linha(over: Partial<ProductPricePoint> = {}): ProductPricePoint {
    return { purchaseDate: "2026-08-05", storeName: "Mercado A", unitPrice: 10, quantity: 1, totalPrice: 10, ...over };
  }

  it("três unidades compradas no mesmo dia viram UM ponto, não três", () => {
    // O bug: o mercado imprime uma linha por unidade, e cada uma virava uma bolinha no gráfico
    // empilhada na mesma data, com a linha zigue-zagueando entre elas.
    const ocasioes = groupPurchaseOccasions([linha(), linha(), linha()]);

    expect(ocasioes).toHaveLength(1);
    expect(ocasioes[0].lines).toBe(3);
    expect(ocasioes[0].quantity).toBe(3);
    expect(ocasioes[0].totalPrice).toBe(30);
    expect(ocasioes[0].unitPrice).toBe(10);
  });

  it("e o card para de dizer '3 compras' pra uma ida só", () => {
    const resumo = summarizeProductPrices([linha(), linha(), linha()])!;
    expect(resumo.timesBought).toBe(1);
    // O que é soma continua somando: gastei 30 reais e levei 3 unidades.
    expect(resumo.totalSpent).toBe(30);
    expect(resumo.totalQuantity).toBe(3);
  });

  it("preços diferentes na mesma ida viram média ponderada pela quantidade", () => {
    // 2 na promoção a 8 e 1 a 14: R$ 30 por 3 unidades = R$ 10 cada, não a média simples (11).
    const ocasioes = groupPurchaseOccasions([
      linha({ quantity: 2, unitPrice: 8, totalPrice: 16 }),
      linha({ quantity: 1, unitPrice: 14, totalPrice: 14 }),
    ]);

    expect(ocasioes).toHaveLength(1);
    expect(ocasioes[0].unitPrice).toBeCloseTo(10, 10);
  });

  it("o mesmo produto em dois mercados no mesmo dia continua sendo duas observações", () => {
    const ocasioes = groupPurchaseOccasions([
      linha({ storeName: "Mercado A", unitPrice: 10, totalPrice: 10 }),
      linha({ storeName: "Mercado B", unitPrice: 13, totalPrice: 13 }),
    ]);

    expect(ocasioes).toHaveLength(2);
    expect(ocasioes.map((o) => o.storeName)).toEqual(["Mercado A", "Mercado B"]);
  });

  it("ordena por data, independente da ordem em que o banco devolveu", () => {
    const ocasioes = groupPurchaseOccasions([
      linha({ purchaseDate: "2026-08-20" }),
      linha({ purchaseDate: "2026-05-10" }),
      linha({ purchaseDate: "2026-07-01" }),
    ]);
    expect(ocasioes.map((o) => o.purchaseDate)).toEqual(["2026-05-10", "2026-07-01", "2026-08-20"]);
  });

  it("a variação de preço compara ocasião com ocasião, não linha com linha", () => {
    const resumo = summarizeProductPrices([
      // Primeira ida: duas linhas que juntas dão R$ 10 a unidade.
      linha({ purchaseDate: "2026-05-10", quantity: 2, unitPrice: 8, totalPrice: 16 }),
      linha({ purchaseDate: "2026-05-10", quantity: 1, unitPrice: 14, totalPrice: 14 }),
      // Segunda ida: R$ 11.
      linha({ purchaseDate: "2026-08-20", quantity: 1, unitPrice: 11, totalPrice: 11 }),
    ])!;

    expect(resumo.timesBought).toBe(2);
    expect(resumo.firstPrice).toBeCloseTo(10, 10);
    expect(resumo.lastPrice).toBe(11);
    expect(resumo.changePercent).toBeCloseTo(10, 10);
  });

  it("uma ida só não tem variação pra mostrar, mesmo com várias linhas", () => {
    expect(summarizeProductPrices([linha(), linha()])!.changePercent).toBeNull();
  });

  it("lista vazia não quebra", () => {
    expect(groupPurchaseOccasions([])).toEqual([]);
  });
});
