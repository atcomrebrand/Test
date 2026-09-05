import { StatementSessionInput, buildStatement } from "./statement-summary";

function sessao(over: Partial<StatementSessionInput> = {}): StatementSessionInput {
  return {
    date: "2026-08-10",
    checkIn: "2026-08-10T09:00:00.000Z",
    checkOut: "2026-08-10T17:00:00.000Z",
    netSeconds: 8 * 3600,
    value: 400,
    notes: null,
    placement: null,
    satisfactionPercent: null,
    responseMinutes: null,
    ...over,
  };
}

const PESSOAL = { audience: "PERSONAL" as const, tracksPlacement: false };
const EMPRESA = { audience: "COMPANY" as const, tracksPlacement: false };

describe("buildStatement — totais", () => {
  it("soma horas e conta dias trabalhados, não sessões", () => {
    const r = buildStatement(
      [sessao(), sessao({ checkIn: "2026-08-10T18:00:00.000Z", netSeconds: 3600, value: 50 }), sessao({ date: "2026-08-11" })],
      PESSOAL,
    );

    expect(r.totals.sessions).toBe(3);
    expect(r.totals.daysWorked).toBe(2);
    expect(r.totals.hours).toBe(17);
  });

  it("a média é por dia TRABALHADO, não por dia do período", () => {
    // 16h em 2 dias = 8h/dia. Dividir pelos 31 dias do mês mediria o calendário, não a jornada.
    const r = buildStatement([sessao(), sessao({ date: "2026-08-25" })], PESSOAL);
    expect(r.totals.averageHoursPerWorkedDay).toBe(8);
  });

  it("valor-hora médio sai do período, não do trabalho", () => {
    const r = buildStatement([sessao({ netSeconds: 3600, value: 50 }), sessao({ date: "2026-08-11", netSeconds: 3600, value: 100 })], PESSOAL);
    expect(r.totals.totalValue).toBe(150);
    expect(r.totals.averageHourlyRate).toBe(75);
  });

  it("período sem sessão não quebra nem divide por zero", () => {
    const r = buildStatement([], PESSOAL);
    expect(r.totals).toMatchObject({ hours: 0, daysWorked: 0, sessions: 0, averageHoursPerWorkedDay: 0, totalValue: 0 });
    expect(r.totals.averageHourlyRate).toBeNull();
    expect(r.byDay).toEqual([]);
  });

  it("ordena por check-in, venha o dado na ordem que vier", () => {
    const r = buildStatement([sessao({ date: "2026-08-20", checkIn: "2026-08-20T09:00:00.000Z" }), sessao()], PESSOAL);
    expect(r.sessions.map((s) => s.date)).toEqual(["2026-08-10", "2026-08-20"]);
    expect(r.byDay.map((d) => d.date)).toEqual(["2026-08-10", "2026-08-20"]);
  });
});

describe("buildStatement — a versão da empresa não carrega dinheiro", () => {
  it("zera valor total e valor-hora", () => {
    const r = buildStatement([sessao()], EMPRESA);
    expect(r.totals.totalValue).toBeNull();
    expect(r.totals.averageHourlyRate).toBeNull();
  });

  it("zera o valor de CADA sessão — não basta esconder o total", () => {
    // A tabela do extrato lista sessão por sessão; deixar o valor na linha entregaria o valor-hora
    // por divisão, mesmo com o total escondido.
    const r = buildStatement([sessao({ value: 400 })], EMPRESA);
    expect(r.sessions[0].value).toBe(0);
  });

  it("mantém tudo que NÃO é dinheiro", () => {
    const r = buildStatement([sessao({ netSeconds: 7200, notes: "Reunião com o cliente" })], {
      audience: "COMPANY",
      tracksPlacement: false,
    });

    expect(r.totals.hours).toBe(2);
    expect(r.totals.daysWorked).toBe(1);
    expect(r.sessions[0].notes).toBe("Reunião com o cliente");
  });
});

describe("buildStatement — colocação", () => {
  const COM = { audience: "PERSONAL" as const, tracksPlacement: true };

  it("trabalho sem o sistema devolve null, e não um bloco zerado", () => {
    // Zero sugeriria "foi medido e deu zero", que é outra coisa.
    expect(buildStatement([sessao()], PESSOAL).placement).toBeNull();
  });

  it("melhor de posição e tempo é o MENOR; o de satisfação é o maior", () => {
    const r = buildStatement(
      [
        sessao({ placement: 8, satisfactionPercent: 88, responseMinutes: 12 }),
        sessao({ date: "2026-08-11", checkIn: "2026-08-11T09:00:00.000Z", placement: 3, satisfactionPercent: 96, responseMinutes: 5 }),
      ],
      COM,
    );

    expect(r.placement!.placement).toMatchObject({ best: 3, average: 5.5, days: 2 });
    expect(r.placement!.satisfaction!.best).toBe(96);
    expect(r.placement!.responseMinutes!.best).toBe(5);
  });

  it("dia sem o número fica fora da média daquela métrica", () => {
    const r = buildStatement(
      [sessao({ placement: 4 }), sessao({ date: "2026-08-11", checkIn: "2026-08-11T09:00:00.000Z", satisfactionPercent: 90 })],
      COM,
    );

    expect(r.placement!.placement).toMatchObject({ days: 1, average: 4 });
    expect(r.placement!.satisfaction).toMatchObject({ days: 1, average: 90 });
    expect(r.placement!.responseMinutes).toBeNull();
  });

  it("a colocação aparece na versão da empresa — ela não é dinheiro", () => {
    const r = buildStatement([sessao({ placement: 2 })], { audience: "COMPANY", tracksPlacement: true });
    expect(r.placement!.placement!.best).toBe(2);
    expect(r.totals.totalValue).toBeNull();
  });

  it("os pontos saem em ordem de data, pro gráfico", () => {
    const r = buildStatement(
      [
        sessao({ date: "2026-08-12", checkIn: "2026-08-12T09:00:00.000Z", placement: 1 }),
        sessao({ date: "2026-08-10", placement: 9 }),
      ],
      COM,
    );
    expect(r.placement!.points.map((p) => p.placement)).toEqual([9, 1]);
  });
});
