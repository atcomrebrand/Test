import {
  averageTicket,
  classifyVip,
  combineRevenue,
  computeChurn,
  computeRetentionCohorts,
  splitPaymentFee,
} from "./revenue";

const em = (iso: string) => new Date(iso);

describe("splitPaymentFee", () => {
  it("aplica percentual sobre o bruto e soma a taxa fixa", () => {
    const r = splitPaymentFee(100, { feePercent: 3.99, feeFixed: 0.39 });
    expect(r.feeAmount).toBe(4.38);
    expect(r.netAmount).toBe(95.62);
  });

  it("sem taxa o líquido é o bruto", () => {
    expect(splitPaymentFee(30, { feePercent: 0, feeFixed: 0 })).toEqual({
      grossAmount: 30,
      feeAmount: 0,
      netAmount: 30,
    });
  });

  it("arredonda pra centavo em vez de vazar casas decimais", () => {
    const r = splitPaymentFee(33.33, { feePercent: 2.5, feeFixed: 0 });
    expect(r.feeAmount).toBe(0.83);
    expect(r.netAmount).toBe(32.5);
  });

  it("deixa o líquido negativo quando a taxa fixa passa do valor", () => {
    // Cobrança de R$ 1 com taxa fixa de R$ 2 dá prejuízo de verdade; zerar aqui faria a receita
    // do mês não fechar com o extrato.
    const r = splitPaymentFee(1, { feePercent: 0, feeFixed: 2 });
    expect(r.netAmount).toBe(-1);
  });
});

describe("computeChurn", () => {
  it("calcula perdidos, ganhos e crescimento líquido", () => {
    const r = computeChurn({ startActive: 100, lost: 4, gained: 12 });
    expect(r.netGrowth).toBe(8);
    expect(r.churnRate).toBe(4);
    expect(r.growthRate).toBe(8);
  });

  it("aceita crescimento negativo", () => {
    const r = computeChurn({ startActive: 50, lost: 10, gained: 3 });
    expect(r.netGrowth).toBe(-7);
    expect(r.growthRate).toBe(-14);
  });

  it("devolve null (não 0%) quando não havia base", () => {
    const r = computeChurn({ startActive: 0, lost: 0, gained: 5 });
    expect(r.churnRate).toBeNull();
    expect(r.netGrowth).toBe(5);
  });
});

describe("computeRetentionCohorts", () => {
  const hoje = em("2026-08-11");

  it("só conta quem teve tempo de alcançar o marco", () => {
    const membros = [
      // Entrou há 2 anos e continua: conta em todos os marcos.
      { startedAt: em("2024-08-11"), endedAt: null },
      // Entrou mês passado: não é elegível a 3, 6, 12 ou 24 meses.
      { startedAt: em("2026-07-11"), endedAt: null },
    ];

    const r = computeRetentionCohorts(membros, hoje);
    const em12 = r.find((p) => p.months === 12)!;
    expect(em12.eligible).toBe(1);
    expect(em12.retained).toBe(1);
    expect(em12.rate).toBe(100);

    const em1 = r.find((p) => p.months === 1)!;
    expect(em1.eligible).toBe(2);
  });

  it("conta como perdido quem saiu antes do marco", () => {
    const membros = [
      { startedAt: em("2025-01-11"), endedAt: em("2025-03-11") }, // sobreviveu 2 meses
      { startedAt: em("2025-01-11"), endedAt: null },
    ];
    const r = computeRetentionCohorts(membros, hoje);
    const em3 = r.find((p) => p.months === 3)!;
    expect(em3.eligible).toBe(2);
    expect(em3.retained).toBe(1);
    expect(em3.rate).toBe(50);
  });

  it("devolve null no marco que ninguém alcançou ainda", () => {
    const r = computeRetentionCohorts([{ startedAt: em("2026-07-11"), endedAt: null }], hoje);
    expect(r.find((p) => p.months === 24)!.rate).toBeNull();
  });
});

describe("classifyVip", () => {
  const criterios = { minMonths: 12, minRevenue: 1000, minRenewals: 10 };

  it("basta um critério, não todos", () => {
    // Cliente novo que gastou muito é VIP mesmo sem os 12 meses.
    expect(classifyVip({ monthsAsCustomer: 2, totalRevenue: 1500, renewals: 2 }, criterios)).toBe(true);
    // Cliente antigo que paga pouco também.
    expect(classifyVip({ monthsAsCustomer: 20, totalRevenue: 200, renewals: 3 }, criterios)).toBe(true);
  });

  it("é falso quando não bate em nenhum", () => {
    expect(classifyVip({ monthsAsCustomer: 3, totalRevenue: 90, renewals: 3 }, criterios)).toBe(false);
  });

  it("ignora critério desligado", () => {
    expect(classifyVip({ monthsAsCustomer: 99, totalRevenue: 0, renewals: 0 }, { minMonths: null })).toBe(false);
  });

  it("nunca desmarca quem foi promovido à mão", () => {
    expect(classifyVip({ monthsAsCustomer: 0, totalRevenue: 0, renewals: 0, vipManual: true }, criterios)).toBe(true);
  });
});

describe("combineRevenue", () => {
  it("mantém as duas origens visíveis junto com o total", () => {
    expect(combineRevenue(7500, 4800)).toEqual({ direct: 7500, reseller: 4800, total: 12300 });
  });
});

describe("averageTicket", () => {
  it("é null sem pagamentos, em vez de zero", () => {
    expect(averageTicket(0, 0)).toBeNull();
    expect(averageTicket(300, 10)).toBe(30);
  });
});
