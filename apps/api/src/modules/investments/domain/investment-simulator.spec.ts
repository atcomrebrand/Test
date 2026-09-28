import {
  monthlyRateFromAnnual,
  monthsToReach,
  poupancaAnnualRate,
  simulateContributions,
  simulateFixedIncome,
} from "./investment-simulator";

const HOJE = new Date("2026-08-25T00:00:00Z");
const TAXAS = { cdiAnnual: 14.9, ipcaAnnual: 4.5, selicAnnual: 15.0 };

function cdb(over: Partial<Parameters<typeof simulateFixedIncome>[0]> = {}) {
  return simulateFixedIncome({
    amount: 10000,
    months: 24,
    type: "CDB",
    indexer: "POS_FIXADO_CDI",
    cdiPercent: 110,
    rates: TAXAS,
    today: HOJE,
    ...over,
  });
}

describe("simulateFixedIncome", () => {
  it("projeta até o vencimento com IR descontado", () => {
    const r = cdb();
    expect(r.maturityDate).toBe("2028-08-25");
    expect(r.grossValue).toBeGreaterThan(10000);
    expect(r.netValue).toBeLessThan(r.grossValue);
    expect(r.netValue - r.invested).toBeCloseTo(r.netYield, 6);
  });

  it("prazo maior cai numa faixa de IR menor — é o principal motivo de simular antes", () => {
    // Até 180 dias o IR é 22,5%; acima de 720 dias, 15%.
    expect(cdb({ months: 5 }).irRate).toBe(22.5);
    expect(cdb({ months: 24 }).irRate).toBe(15);
  });

  it("LCI é isenta, então rende mais que um CDB idêntico", () => {
    const lci = cdb({ type: "LCI" });
    expect(lci.irAmount).toBe(0);
    expect(lci.netValue).toBeGreaterThan(cdb().netValue);
  });

  it("o IOF só morde abaixo de 30 dias — e um mês, quase sempre, já passou disso", () => {
    // 25/08 + 1 mês = 31 dias: livre. É o caso comum, e por isso o simulador quase nunca mostra IOF.
    expect(cdb({ months: 1 }).iofRate).toBe(0);

    // Fevereiro é a exceção que existe de verdade: 31/01 + 1 mês = 28 dias, dentro da janela.
    const fevereiro = cdb({ today: new Date("2026-01-31T00:00:00Z"), months: 1 });
    expect(fevereiro.days).toBe(28);
    expect(fevereiro.iofRate).toBeGreaterThan(0);
    expect(fevereiro.iofAmount).toBeGreaterThan(0);
  });

  it("130% do CDI rende mais que 100% — o percentual entra na taxa diária", () => {
    expect(cdb({ cdiPercent: 130 }).netValue).toBeGreaterThan(cdb({ cdiPercent: 100 }).netValue);
  });

  it("prefixado não depende do CDI", () => {
    const a = cdb({ indexer: "PREFIXADO", cdiPercent: null, fixedRatePercent: 12 });
    const b = simulateFixedIncome({
      amount: 10000, months: 24, type: "CDB", indexer: "PREFIXADO", fixedRatePercent: 12,
      rates: { ...TAXAS, cdiAnnual: 30 }, today: HOJE,
    });
    expect(a.netValue).toBeCloseTo(b.netValue, 6);
  });

  it("a taxa ao ano põe prazos diferentes na mesma régua", () => {
    // Dois papéis idênticos em prazo diferente têm rendimento no período diferente, mas a taxa
    // anualizada fica próxima — é ela que responde "qual é melhor".
    const curto = cdb({ months: 12 });
    const longo = cdb({ months: 24 });
    expect(longo.netPercent).toBeGreaterThan(curto.netPercent);
    expect(Math.abs(longo.netAnnualPercent - curto.netAnnualPercent)).toBeLessThan(2);
  });

  it("vencimento em mês curto não pula pro mês seguinte", () => {
    // 31/01 + 1 mês não existe: tem que virar 28/02, não 03/03.
    const r = cdb({ today: new Date("2026-01-31T00:00:00Z"), months: 1 });
    expect(r.maturityDate).toBe("2026-02-28");
  });
});

describe("poupancaAnnualRate", () => {
  it("com Selic alta, é 0,5% ao mês — os famosos 6,17% ao ano", () => {
    expect(poupancaAnnualRate(15)).toBeCloseTo(6.17, 2);
    expect(poupancaAnnualRate(8.51)).toBeCloseTo(6.17, 2);
  });

  it("com Selic baixa, vira 70% dela", () => {
    expect(poupancaAnnualRate(8.5)).toBeCloseTo(5.95, 2);
    expect(poupancaAnnualRate(2)).toBeCloseTo(1.4, 2);
  });

  it("e por isso ela perde feio pro CDI quando a Selic está alta", () => {
    expect(poupancaAnnualRate(15)).toBeLessThan(15);
  });
});

describe("monthlyRateFromAnnual", () => {
  it("12% ao ano são 0,9489% ao mês, não 1%", () => {
    // Dividir por 12 ignora que o juro do mês rende no mês seguinte. Parece detalhe e vira
    // milhares de reais no horizonte pra que essa simulação existe.
    expect(monthlyRateFromAnnual(12) * 100).toBeCloseTo(0.9489, 4);
    expect(monthlyRateFromAnnual(12) * 100).not.toBeCloseTo(1, 3);
  });

  it("doze meses da taxa mensal reconstroem a anual", () => {
    expect((Math.pow(1 + monthlyRateFromAnnual(14.9), 12) - 1) * 100).toBeCloseTo(14.9, 8);
  });

  it("taxa zero não rende nada", () => {
    expect(monthlyRateFromAnnual(0)).toBe(0);
  });
});

describe("simulateContributions", () => {
  it("sem juro, o total é exatamente o que foi aportado", () => {
    const r = simulateContributions({ initialAmount: 1000, monthlyAmount: 100, annualRatePercent: 0, months: 12 });
    expect(r.total).toBeCloseTo(2200, 6);
    expect(r.interest).toBeCloseTo(0, 6);
    expect(r.interestShare).toBeCloseTo(0, 6);
  });

  it("o aporte entra no fim do mês: o do mês 1 não rende no mês 1", () => {
    const r = simulateContributions({ initialAmount: 0, monthlyAmount: 100, annualRatePercent: 12, months: 1 });
    expect(r.total).toBeCloseTo(100, 6);
    expect(r.interest).toBeCloseTo(0, 6);
  });

  it("só valor inicial rende composto", () => {
    const r = simulateContributions({ initialAmount: 1000, monthlyAmount: 0, annualRatePercent: 12, months: 12 });
    expect(r.total).toBeCloseTo(1120, 6);
  });

  it("guarda um ponto por mês, começando no mês zero", () => {
    const r = simulateContributions({ initialAmount: 500, monthlyAmount: 50, annualRatePercent: 10, months: 24 });
    expect(r.points).toHaveLength(25);
    expect(r.points[0]).toEqual({ month: 0, contributed: 500, interest: 0, total: 500 });
    expect(r.points[24].total).toBeCloseTo(r.total, 6);
  });

  it("no longo prazo o juro passa o aporte — é o que a tela existe pra mostrar", () => {
    const r = simulateContributions({ initialAmount: 0, monthlyAmount: 500, annualRatePercent: 12, months: 12 * 25 });
    expect(r.interestShare).toBeGreaterThan(50);
  });

  it("prazo zero devolve só o ponto inicial", () => {
    const r = simulateContributions({ initialAmount: 1000, monthlyAmount: 100, annualRatePercent: 10, months: 0 });
    expect(r.points).toHaveLength(1);
    expect(r.total).toBe(1000);
  });
});

describe("monthsToReach", () => {
  it("alvo já alcançado é zero mês", () => {
    expect(monthsToReach(1000, { initialAmount: 1000, monthlyAmount: 100, annualRatePercent: 10 })).toBe(0);
  });

  it("sem juro, é a divisão simples", () => {
    expect(monthsToReach(1000, { initialAmount: 0, monthlyAmount: 100, annualRatePercent: 0 })).toBe(10);
  });

  it("com juro, chega antes", () => {
    const comJuro = monthsToReach(100000, { initialAmount: 0, monthlyAmount: 500, annualRatePercent: 12 })!;
    const semJuro = monthsToReach(100000, { initialAmount: 0, monthlyAmount: 500, annualRatePercent: 0 })!;
    expect(comJuro).toBeLessThan(semJuro);
  });

  it("alvo inalcançável devolve null em vez de fingir um número", () => {
    expect(monthsToReach(1000, { initialAmount: 0, monthlyAmount: 0, annualRatePercent: 0 })).toBeNull();
  });
});
