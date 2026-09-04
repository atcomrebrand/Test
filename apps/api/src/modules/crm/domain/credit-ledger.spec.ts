import {
  classifyResellerActivity,
  computeCreditBalance,
  isLowCredit,
  signedQuantity,
  summarizeCredits,
  summarizeRecharges,
} from "./credit-ledger";

const em = (iso: string) => new Date(iso);
const mov = (quantity: number, kind: "RECHARGE" | "USAGE" | "ADJUSTMENT" = "RECHARGE") => ({
  kind,
  quantity,
  createdAt: em("2026-08-01"),
});

describe("computeCreditBalance", () => {
  it("é a soma das movimentações", () => {
    // O exemplo do briefing: 20 anteriores + 50 de recarga − 8 de uso = 62.
    expect(computeCreditBalance([mov(20), mov(50), mov(-8, "USAGE")])).toBe(62);
  });

  it("é zero sem movimentação", () => {
    expect(computeCreditBalance([])).toBe(0);
  });

  it("aceita saldo negativo em vez de esconder", () => {
    // Consumo além do saldo é um fato operacional; zerar aqui mentiria sobre o extrato.
    expect(computeCreditBalance([mov(10), mov(-15, "USAGE")])).toBe(-5);
  });
});

describe("summarizeCredits", () => {
  it("separa entrada de saída e fecha com o saldo", () => {
    const r = summarizeCredits([mov(50), mov(30), mov(-8, "USAGE"), mov(-2, "USAGE")]);
    expect(r).toEqual({ balance: 70, purchased: 80, used: 10 });
  });

  it("conta ajuste negativo como uso, não como compra negativa", () => {
    const r = summarizeCredits([mov(50), mov(-5, "ADJUSTMENT")]);
    expect(r).toEqual({ balance: 45, purchased: 50, used: 5 });
  });
});

describe("signedQuantity", () => {
  it("força o sinal por tipo, ignorando o que a UI mandou", () => {
    expect(signedQuantity("USAGE", 8)).toBe(-8);
    expect(signedQuantity("USAGE", -8)).toBe(-8);
    expect(signedQuantity("RECHARGE", 50)).toBe(50);
    expect(signedQuantity("RECHARGE", -50)).toBe(50);
  });

  it("respeita o sinal só no ajuste, que existe pra corrigir nas duas direções", () => {
    expect(signedQuantity("ADJUSTMENT", 5)).toBe(5);
    expect(signedQuantity("ADJUSTMENT", -5)).toBe(-5);
  });
});

describe("isLowCredit", () => {
  it("alerta no limite, não só abaixo dele", () => {
    expect(isLowCredit({ balance: 10, threshold: 10 })).toBe(true);
    expect(isLowCredit({ balance: 11, threshold: 10 })).toBe(false);
    expect(isLowCredit({ balance: 4, threshold: 10 })).toBe(true);
  });
});

describe("classifyResellerActivity", () => {
  const hoje = em("2026-08-11");
  const janelas = { attentionDays: 30, inactiveDays: 60 };

  it("é verde quando recarregou há pouco", () => {
    const r = classifyResellerActivity({ lastRechargeAt: em("2026-08-01"), today: hoje, ...janelas });
    expect(r.activity).toBe("ACTIVE");
    expect(r.daysSinceLastRecharge).toBe(10);
  });

  it("vira amarelo e depois vermelho nas janelas configuradas", () => {
    // 13/07 = 29 dias, ainda verde; 12/07 = 30 dias, já entra na janela de atenção.
    expect(classifyResellerActivity({ lastRechargeAt: em("2026-07-13"), today: hoje, ...janelas }).activity).toBe(
      "ACTIVE",
    );
    expect(classifyResellerActivity({ lastRechargeAt: em("2026-07-12"), today: hoje, ...janelas }).activity).toBe(
      "ATTENTION",
    );
    // 13/06 = 59 dias, ainda amarelo; 12/06 = 60 dias, fecha em vermelho.
    expect(classifyResellerActivity({ lastRechargeAt: em("2026-06-13"), today: hoje, ...janelas }).activity).toBe(
      "ATTENTION",
    );
    expect(classifyResellerActivity({ lastRechargeAt: em("2026-06-12"), today: hoje, ...janelas }).activity).toBe(
      "INACTIVE",
    );
  });

  it("trata quem nunca recarregou como inativo", () => {
    // Verde aqui esconderia justamente quem mais precisa de contato.
    const r = classifyResellerActivity({ lastRechargeAt: null, today: hoje, ...janelas });
    expect(r).toEqual({ activity: "INACTIVE", daysSinceLastRecharge: null });
  });

  it("respeita janelas customizadas", () => {
    const r = classifyResellerActivity({
      lastRechargeAt: em("2026-08-04"),
      today: hoje,
      attentionDays: 7,
      inactiveDays: 14,
    });
    expect(r.activity).toBe("ATTENTION");
  });
});

describe("summarizeRecharges", () => {
  const recargas = [
    { quantity: 50, totalAmount: 250 },
    { quantity: 30, totalAmount: 135 },
  ];

  it("soma e calcula o preço médio pago por crédito", () => {
    const r = summarizeRecharges(recargas, 4);
    expect(r.totalRecharges).toBe(2);
    expect(r.totalCreditsPurchased).toBe(80);
    expect(r.totalSpent).toBe(385);
    // 385 / 80 — média ponderada real, não a média dos dois preços unitários (4,81 ≠ 4,75).
    expect(r.averageCreditPrice).toBeCloseTo(4.8125, 4);
    expect(r.rechargesPerMonth).toBeCloseTo(0.5, 4);
    expect(r.creditsPerMonth).toBeCloseTo(20, 4);
  });

  it("devolve null (não zero) pro preço médio quando não houve compra", () => {
    // Zero diria "cada crédito custou R$ 0", que é diferente de "não dá pra saber".
    const r = summarizeRecharges([], 3);
    expect(r.averageCreditPrice).toBeNull();
    expect(r.rechargesPerMonth).toBeNull();
    expect(r.totalSpent).toBe(0);
  });

  it("não estoura a média com menos de um mês de relação", () => {
    const r = summarizeRecharges([{ quantity: 10, totalAmount: 50 }], 0);
    expect(r.rechargesPerMonth).toBe(1);
  });
});
