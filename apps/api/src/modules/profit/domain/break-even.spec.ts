import { computeBreakEven, discountImpact, unitsForTargetProfit } from "./break-even";
import { computeUnitEconomics } from "./pricing";

const SEM_TAXA = { percent: 0, fixed: 0 };

function entrada(over: Partial<Parameters<typeof computeUnitEconomics>[0]> = {}) {
  return {
    price: 100,
    cost: 50,
    packagingCost: 0,
    shippingCost: 0,
    extraCost: 0,
    channelFee: SEM_TAXA,
    taxPercent: 0,
    returnRatePercent: 0,
    ...over,
  };
}

/** Custo 50, taxa de 20%, preço 100 → sobram R$ 30 por venda. */
const ECONOMIA = computeUnitEconomics(entrada({ channelFee: { percent: 20, fixed: 0 } }));

describe("computeBreakEven", () => {
  it("custo fixo dividido pela margem de contribuição", () => {
    const r = computeBreakEven(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 0 });
    expect(r.contributionMargin).toBe(30);
    expect(r.units).toBe(34); // 1000/30 = 33,3 → 34
    expect(r.revenue).toBe(3400);
  });

  it("arredonda pra CIMA — fração de venda não existe", () => {
    // 33,3 vendas arredondadas pra baixo deixariam o mês no vermelho por uma fração.
    const r = computeBreakEven(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 0 });
    expect(r.units).toBe(34);
    expect(r.units! * r.contributionMargin).toBeGreaterThanOrEqual(1000);
  });

  it("o DAS do MEI entra no custo fixo, nunca no preço unitário", () => {
    // Rateá-lo por unidade exigiria saber de antemão quantas vendas — que é a pergunta desta conta.
    const r = computeBreakEven(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 76 });
    expect(r.monthlyCost).toBe(1076);
    expect(r.units).toBe(36);
  });

  it("sem custo fixo, o equilíbrio é a primeira venda", () => {
    const r = computeBreakEven(ECONOMIA, { monthlyFixedCost: 0, monthlyFixedTax: 0 });
    expect(r.units).toBe(0);
  });

  it("margem de contribuição negativa não tem equilíbrio — vender mais piora", () => {
    // Devolver infinito viraria número na tela; devolver zero diria que já está empatado.
    const ruim = computeUnitEconomics(entrada({ price: 40 }));
    const r = computeBreakEven(ruim, { monthlyFixedCost: 1000, monthlyFixedTax: 0 });

    expect(r.units).toBeNull();
    expect(r.revenue).toBeNull();
  });

  it("margem de contribuição exatamente zero também não tem equilíbrio", () => {
    const empate = computeUnitEconomics(entrada({ price: 50 }));
    expect(computeBreakEven(empate, { monthlyFixedCost: 1000, monthlyFixedTax: 0 }).units).toBeNull();
  });
});

describe("unitsForTargetProfit", () => {
  it("com custo fixo NÃO é meta ÷ lucro unitário", () => {
    // A conta ingênua daria 2000/30 = 67. O certo é cobrir o fixo primeiro: (1000+2000)/30 = 100.
    const r = unitsForTargetProfit(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 0 }, 2000);

    expect(r.unitsForTarget).toBe(100);
    expect(r.unitsForTarget).not.toBe(67);
  });

  it("sem custo fixo as duas contas coincidem", () => {
    const r = unitsForTargetProfit(ECONOMIA, { monthlyFixedCost: 0, monthlyFixedTax: 0 }, 2000);
    expect(r.unitsForTarget).toBe(67); // 2000/30 = 66,7 → 67
  });

  it("diz quantas vendas depois do equilíbrio o lucro começa", () => {
    const r = unitsForTargetProfit(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 0 }, 2000);
    expect(r.units).toBe(34);
    expect(r.unitsBeyondBreakEven).toBe(66);
  });

  it("meta zero é o próprio ponto de equilíbrio", () => {
    const r = unitsForTargetProfit(ECONOMIA, { monthlyFixedCost: 1000, monthlyFixedTax: 0 }, 0);
    expect(r.unitsForTarget).toBe(r.units);
  });

  it("sem margem de contribuição, nenhuma meta é alcançável", () => {
    const ruim = computeUnitEconomics(entrada({ price: 40 }));
    const r = unitsForTargetProfit(ruim, { monthlyFixedCost: 1000, monthlyFixedTax: 0 }, 2000);
    expect(r.unitsForTarget).toBeNull();
  });
});

describe("discountImpact — o desconto sai de cima da margem", () => {
  it("10% de desconto num produto de 30% de margem leva um TERÇO do lucro", () => {
    // É o número que faz alguém parar de dar desconto achando que perdeu 10%.
    const r = discountImpact(entrada({ channelFee: { percent: 20, fixed: 0 } }), 10);

    expect(r.newPrice).toBe(90);
    expect(r.profitLost).toBe(8); // taxa também cai com o preço, então não são 10 cheios
    expect(r.profitLostPercent).toBe(26.67);
  });

  it("diz quantas vendas a mais pra manter o mesmo lucro", () => {
    const r = discountImpact(entrada({ channelFee: { percent: 20, fixed: 0 } }), 10);
    expect(r.newEconomics.profit).toBe(22);
    expect(r.extraUnitsForSameProfit).toBe(1); // 30/22 = 1,36 → 2 vendas, ou seja 1 a mais
  });

  it("marca quando o desconto passa do piso", () => {
    const r = discountImpact(entrada({ channelFee: { percent: 20, fixed: 0 } }), 50);
    expect(r.belowMinimum).toBe(true);
    expect(r.newEconomics.profit).toBeLessThan(0);
  });

  it("desconto zero não muda nada", () => {
    const r = discountImpact(entrada(), 0);
    expect(r.profitLost).toBe(0);
    expect(r.profitLostPercent).toBe(0);
  });

  it("quem já estava no prejuízo não ganha porcentagem sem sentido", () => {
    // % de perda sobre um lucro negativo não se lê.
    const r = discountImpact(entrada({ price: 40 }), 10);
    expect(r.profitLostPercent).toBe(0);
    expect(r.extraUnitsForSameProfit).toBeNull();
  });

  it("desconto é limitado a 100%", () => {
    const r = discountImpact(entrada(), 150);
    expect(r.discountPercent).toBe(100);
    expect(r.newPrice).toBe(0);
  });
});
