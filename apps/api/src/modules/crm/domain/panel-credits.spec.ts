import {
  averagePanelCreditPrice,
  checkCreditAvailability,
  computePanelBalance,
  computeProfit,
  groupRevenueByCurrency,
  resolveCreditCost,
} from "./panel-credits";

const mov = (quantity: number) => ({ quantity, createdAt: new Date("2026-08-01") });

describe("computePanelBalance", () => {
  it("soma o extrato", () => {
    expect(computePanelBalance([mov(500), mov(-1), mov(-12), mov(200)])).toBe(687);
  });

  it("é zero sem movimentação", () => {
    expect(computePanelBalance([])).toBe(0);
  });
});

describe("resolveCreditCost", () => {
  it("usa o plano quando a assinatura não sobrescreve", () => {
    expect(resolveCreditCost(null, 12)).toBe(12);
    expect(resolveCreditCost(undefined, 3)).toBe(3);
  });

  it("a assinatura vence o plano", () => {
    // Cliente com combinado diferente do pacote padrão.
    expect(resolveCreditCost(2, 12)).toBe(2);
  });

  it("cai em 1 quando não há nada definido", () => {
    // Nunca 0: renovação que não consome faria o estoque não baixar e o saldo mentir pra sempre.
    expect(resolveCreditCost(null, null)).toBe(1);
    expect(resolveCreditCost(0, 0)).toBe(1);
  });
});

describe("checkCreditAvailability", () => {
  it("aprova quando o saldo cobre, inclusive na igualdade", () => {
    expect(checkCreditAvailability(12, 12)).toEqual({ balance: 12, required: 12, enough: true, missing: 0 });
    expect(checkCreditAvailability(50, 1).enough).toBe(true);
  });

  it("reprova e diz quanto falta", () => {
    expect(checkCreditAvailability(5, 12)).toEqual({ balance: 5, required: 12, enough: false, missing: 7 });
  });

  it("conta o que falta a partir de saldo negativo", () => {
    expect(checkCreditAvailability(-3, 2).missing).toBe(5);
  });
});

describe("averagePanelCreditPrice", () => {
  it("pondera pela quantidade, não pela média dos preços", () => {
    // 1000 a R$0,90 + 10 a R$2,00 = R$920 / 1010 créditos ≈ 0,9109.
    // A média simples dos dois preços daria 1,45 — 59% a mais de custo do que a realidade.
    const r = averagePanelCreditPrice([
      { quantity: 1000, totalAmount: 900 },
      { quantity: 10, totalAmount: 20 },
    ]);
    expect(r).toBeCloseTo(0.9109, 4);
  });

  it("é null sem compras, não zero", () => {
    // Zero diria "o crédito é de graça", que é diferente de "não dá pra saber".
    expect(averagePanelCreditPrice([])).toBeNull();
  });
});

describe("computeProfit", () => {
  it("desconta taxas e custo dos créditos", () => {
    const r = computeProfit({ grossRevenue: 1000, fees: 40, creditsConsumed: 100, averageCreditPrice: 0.9 });
    expect(r.creditCost).toBe(90);
    expect(r.profit).toBe(870);
    expect(r.margin).toBe(87);
    expect(r.costUnknown).toBe(false);
  });

  it("avisa quando o custo não pôde ser apurado", () => {
    // Sem compra registrada a margem sai cheia; sem a flag, pareceria lucro de 100%.
    const r = computeProfit({ grossRevenue: 500, fees: 0, creditsConsumed: 30, averageCreditPrice: null });
    expect(r.creditCost).toBe(0);
    expect(r.profit).toBe(500);
    expect(r.costUnknown).toBe(true);
  });

  it("não marca custo desconhecido quando não houve consumo", () => {
    const r = computeProfit({ grossRevenue: 100, fees: 0, creditsConsumed: 0, averageCreditPrice: null });
    expect(r.costUnknown).toBe(false);
  });

  it("aceita prejuízo", () => {
    const r = computeProfit({ grossRevenue: 50, fees: 5, creditsConsumed: 100, averageCreditPrice: 1 });
    expect(r.profit).toBe(-55);
    expect(r.margin).toBe(-110);
  });

  it("margem é null sem receita", () => {
    expect(computeProfit({ grossRevenue: 0, fees: 0, creditsConsumed: 0, averageCreditPrice: 1 }).margin).toBeNull();
  });
});

describe("groupRevenueByCurrency", () => {
  it("nunca soma moedas diferentes", () => {
    const r = groupRevenueByCurrency([
      { currency: "BRL", direct: 1000, reseller: 500 },
      { currency: "USD", direct: 200, reseller: 100 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ currency: "BRL", direct: 1000, reseller: 500, total: 1500 });
    expect(r[1]).toEqual({ currency: "USD", direct: 200, reseller: 100, total: 300 });
  });

  it("agrupa serviços da mesma moeda", () => {
    const r = groupRevenueByCurrency([
      { currency: "BRL", direct: 100, reseller: 0 },
      { currency: "BRL", direct: 50, reseller: 25 },
    ]);
    expect(r).toEqual([{ currency: "BRL", direct: 150, reseller: 25, total: 175 }]);
  });

  it("põe o real primeiro, pra tela não trocar de lugar entre visitas", () => {
    const r = groupRevenueByCurrency([
      { currency: "USD", direct: 10, reseller: 0 },
      { currency: "BRL", direct: 20, reseller: 0 },
    ]);
    expect(r.map((b) => b.currency)).toEqual(["BRL", "USD"]);
  });

  it("é vazio sem entradas", () => {
    expect(groupRevenueByCurrency([])).toEqual([]);
  });
});
