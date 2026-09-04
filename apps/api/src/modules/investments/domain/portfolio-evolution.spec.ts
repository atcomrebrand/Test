import {
  buildAssetEvolution,
  buildCdiIndex,
  buildDateGrid,
  buildPriceIndex,
  buildReturnIndex,
  closeAtOrBefore,
  DatedClose,
  EvolutionTransaction,
  buildFixedIncomeEvolution,
  FixedIncomeSnapshot,
  resolveEvolutionWindow,
  totalReturnPercent,
} from "./portfolio-evolution";

const HOJE = new Date("2026-08-23T12:00:00Z");

function tx(partial: Partial<EvolutionTransaction> & { date: string }): EvolutionTransaction {
  return {
    assetId: "a1",
    type: "BUY",
    quantity: 10,
    unitPrice: 10,
    fees: 0,
    ...partial,
  };
}

describe("resolveEvolutionWindow", () => {
  it("anda por mês de calendário, não por múltiplos de 30 dias", () => {
    expect(resolveEvolutionWindow("1M", undefined, undefined, HOJE)).toEqual({
      from: "2026-07-23",
      to: "2026-08-23",
    });
    expect(resolveEvolutionWindow("12M", undefined, undefined, HOJE)).toEqual({
      from: "2025-08-23",
      to: "2026-08-23",
    });
  });

  it("3M e 6M partem do mesmo dia dos meses anteriores", () => {
    expect(resolveEvolutionWindow("3M", undefined, undefined, HOJE).from).toBe("2026-05-23");
    expect(resolveEvolutionWindow("6M", undefined, undefined, HOJE).from).toBe("2026-02-23");
  });

  it("CUSTOM sem as duas pontas cai em 12M em vez de devolver janela vazia", () => {
    expect(resolveEvolutionWindow("CUSTOM", "2026-01-01", undefined, HOJE)).toEqual({
      from: "2025-08-23",
      to: "2026-08-23",
    });
  });

  it("CUSTOM invertido é digitação trocada, não erro: normaliza a ordem", () => {
    expect(resolveEvolutionWindow("CUSTOM", "2026-06-01", "2026-03-01", HOJE)).toEqual({
      from: "2026-03-01",
      to: "2026-06-01",
    });
  });
});

describe("buildDateGrid", () => {
  it("janela curta vira um ponto por dia", () => {
    const grid = buildDateGrid({ from: "2026-08-20", to: "2026-08-23" });
    expect(grid).toEqual(["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"]);
  });

  it("um ano não vira 366 pontos", () => {
    const grid = buildDateGrid({ from: "2025-08-23", to: "2026-08-23" });
    expect(grid.length).toBeLessThanOrEqual(121);
    expect(grid.length).toBeGreaterThan(80);
  });

  it("a última data sempre entra, mesmo quando o passo não fecha certinho", () => {
    const grid = buildDateGrid({ from: "2025-08-23", to: "2026-08-23" });
    expect(grid[0]).toBe("2025-08-23");
    expect(grid[grid.length - 1]).toBe("2026-08-23");
  });

  it("janela de um dia só devolve esse dia", () => {
    expect(buildDateGrid({ from: "2026-08-23", to: "2026-08-23" })).toEqual(["2026-08-23"]);
  });
});

describe("closeAtOrBefore", () => {
  const serie: DatedClose[] = [
    { date: "2026-08-20", close: 10 },
    { date: "2026-08-21", close: 12 },
  ];

  it("carrega o último fechamento pra frente no fim de semana", () => {
    // 21/08/2026 é uma sexta; sábado e domingo repetem o fechamento dela.
    expect(closeAtOrBefore(serie, "2026-08-22")).toBe(12);
    expect(closeAtOrBefore(serie, "2026-08-23")).toBe(12);
  });

  it("devolve null antes do primeiro fechamento em vez de zero", () => {
    expect(closeAtOrBefore(serie, "2026-08-19")).toBeNull();
  });
});

describe("buildAssetEvolution", () => {
  const tickers = new Map([["a1", "PETR4"]]);

  it("posição × fechamento do dia, com o custo separado do valor", () => {
    const grid = ["2026-01-04", "2026-01-05", "2026-01-06"];
    const series = new Map<string, DatedClose[]>([
      [
        "a1",
        [
          { date: "2026-01-05", close: 10 },
          { date: "2026-01-06", close: 12 },
        ],
      ],
    ]);

    const { points } = buildAssetEvolution(grid, [tx({ date: "2026-01-05" })], series, tickers);

    expect(points[0]).toEqual({ date: "2026-01-04", value: 0, invested: 0, flow: 0 });
    expect(points[1]).toEqual({ date: "2026-01-05", value: 100, invested: 100, flow: 100 });
    expect(points[2]).toEqual({ date: "2026-01-06", value: 120, invested: 100, flow: 0 });
  });

  it("taxa entra no custo e no dinheiro que saiu do bolso", () => {
    const grid = ["2026-01-05"];
    const series = new Map<string, DatedClose[]>([["a1", [{ date: "2026-01-05", close: 10 }]]]);

    const { points } = buildAssetEvolution(grid, [tx({ date: "2026-01-05", fees: 5 })], series, tickers);

    expect(points[0].invested).toBe(105);
    expect(points[0].flow).toBe(105);
    expect(points[0].value).toBe(100);
  });

  it("venda reduz o investido pelo preço médio, não pelo preço da venda", () => {
    const grid = ["2026-01-10"];
    const series = new Map<string, DatedClose[]>([["a1", [{ date: "2026-01-10", close: 20 }]]]);
    const transacoes = [
      tx({ date: "2026-01-05", quantity: 10, unitPrice: 10 }),
      tx({ date: "2026-01-08", type: "SELL", quantity: 5, unitPrice: 20 }),
    ];

    const { points } = buildAssetEvolution(grid, transacoes, series, tickers);

    // Sobraram 5 cotas a R$ 10 de média: R$ 50 de custo, R$ 100 de valor.
    expect(points[0].invested).toBe(50);
    expect(points[0].value).toBe(100);
    // O caixa: R$ 100 saíram na compra e R$ 100 voltaram na venda.
    expect(points[0].flow).toBe(0);
  });

  it("ativo sem série nenhuma fica fora da soma e é reportado, em vez de entrar valendo zero", () => {
    const grid = ["2026-01-10"];
    const series = new Map<string, DatedClose[]>([["a1", [{ date: "2026-01-05", close: 10 }]]]);
    const transacoes = [
      tx({ date: "2026-01-05" }),
      tx({ assetId: "a2", date: "2026-01-05", quantity: 3, unitPrice: 100 }),
    ];

    const resultado = buildAssetEvolution(
      grid,
      transacoes,
      series,
      new Map([
        ["a1", "PETR4"],
        ["a2", "XPTO11"],
      ]),
    );

    expect(resultado.points[0].value).toBe(100);
    expect(resultado.points[0].invested).toBe(100);
    expect(resultado.withoutHistory).toEqual(["XPTO11"]);
  });

  it("com posição aberta mas sem fechamento ainda, avalia pelo preço médio (lucro zero)", () => {
    const grid = ["2026-01-05", "2026-01-06"];
    const series = new Map<string, DatedClose[]>([["a1", [{ date: "2026-01-06", close: 12 }]]]);

    const { points } = buildAssetEvolution(grid, [tx({ date: "2026-01-05" })], series, tickers);

    expect(points[0].value).toBe(100);
    expect(points[0].invested).toBe(100);
  });

  it("ativo comprado no meio da janela não conta nada antes da primeira compra", () => {
    const grid = ["2026-01-01", "2026-01-05"];
    const series = new Map<string, DatedClose[]>([
      [
        "a1",
        [
          { date: "2026-01-01", close: 9 },
          { date: "2026-01-05", close: 10 },
        ],
      ],
    ]);

    const { points } = buildAssetEvolution(grid, [tx({ date: "2026-01-05" })], series, tickers);

    expect(points[0].value).toBe(0);
    expect(points[1].value).toBe(100);
  });

  it("posição zerada some do gráfico e a média reseta pra próxima compra", () => {
    const grid = ["2026-01-20"];
    const series = new Map<string, DatedClose[]>([["a1", [{ date: "2026-01-20", close: 30 }]]]);
    const transacoes = [
      tx({ date: "2026-01-05", quantity: 10, unitPrice: 10 }),
      tx({ date: "2026-01-08", type: "SELL", quantity: 10, unitPrice: 20 }),
    ];

    const { points } = buildAssetEvolution(grid, transacoes, series, tickers);
    expect(points[0].value).toBe(0);
    expect(points[0].invested).toBe(0);
  });
});

describe("buildReturnIndex", () => {
  it("valorização pura vira retorno", () => {
    const indice = buildReturnIndex([
      { date: "d1", value: 100, invested: 100, flow: 0 },
      { date: "d2", value: 110, invested: 100, flow: 0 },
    ]);
    expect(indice[0]).toBe(100);
    expect(indice[1]).toBeCloseTo(110, 10);
  });

  it("aporte NÃO vira rentabilidade — é o erro que esse índice existe pra impedir", () => {
    const indice = buildReturnIndex([
      { date: "d1", value: 100, invested: 100, flow: 0 },
      { date: "d2", value: 200, invested: 200, flow: 100 },
    ]);
    expect(indice[1]).toBeCloseTo(100, 10);
  });

  it("resgate não vira prejuízo", () => {
    const indice = buildReturnIndex([
      { date: "d1", value: 200, invested: 200, flow: 0 },
      { date: "d2", value: 100, invested: 100, flow: -100 },
    ]);
    expect(indice[1]).toBeCloseTo(100, 10);
  });

  it("aporte e valorização no mesmo intervalo separam um do outro", () => {
    // Começou com 100, aportou 100 e terminou com 220: os R$ 200 investidos renderam 10%.
    const indice = buildReturnIndex([
      { date: "d1", value: 100, invested: 100, flow: 0 },
      { date: "d2", value: 220, invested: 200, flow: 100 },
    ]);
    expect(indice[1]).toBeCloseTo(110, 10);
  });

  it("intervalo sem base repete o índice em vez de dividir por zero", () => {
    const indice = buildReturnIndex([
      { date: "d1", value: 0, invested: 0, flow: 0 },
      { date: "d2", value: 0, invested: 0, flow: 0 },
      { date: "d3", value: 100, invested: 100, flow: 100 },
    ]);
    expect(indice).toEqual([100, 100, 100]);
  });

  it("encadeia os intervalos: dois de +10% dão +21%, não +20%", () => {
    const indice = buildReturnIndex([
      { date: "d1", value: 100, invested: 100, flow: 0 },
      { date: "d2", value: 110, invested: 100, flow: 0 },
      { date: "d3", value: 121, invested: 100, flow: 0 },
    ]);
    expect(indice[2]).toBeCloseTo(121, 10);
  });
});

describe("totalReturnPercent", () => {
  it("mede a ponta contra a base", () => {
    expect(totalReturnPercent([100, 110])).toBeCloseTo(10, 10);
  });

  it("ignora os buracos do começo da série", () => {
    expect(totalReturnPercent([null, 100, 120])).toBeCloseTo(20, 10);
  });

  it("um ponto só não é variação", () => {
    expect(totalReturnPercent([100])).toBeNull();
    expect(totalReturnPercent([null, null])).toBeNull();
  });
});

describe("buildCdiIndex", () => {
  const grid = ["2026-01-01", "2026-01-02", "2026-01-05"];

  it("acumula a taxa diária dia a dia a partir da base", () => {
    const indice = buildCdiIndex(
      [
        { date: "2026-01-02", value: 0.05 },
        { date: "2026-01-05", value: 0.05 },
      ],
      grid,
    );

    expect(indice[0]).toBe(100);
    expect(indice[1]).toBeCloseTo(100 * 1.0005, 10);
    expect(indice[2]).toBeCloseTo(100 * 1.0005 * 1.0005, 10);
  });

  it("taxa do próprio dia da base não conta — senão o gráfico já começaria rendendo", () => {
    const indice = buildCdiIndex([{ date: "2026-01-01", value: 0.05 }], grid);
    expect(indice[0]).toBe(100);
    expect(indice[1]).toBe(100);
  });

  it("dias úteis que caem entre dois pontos do grid entram na conta", () => {
    // 03 e 04/01 caem entre 02 e 05: as taxas deles pertencem ao intervalo, não podem sumir.
    const indice = buildCdiIndex(
      [
        { date: "2026-01-02", value: 0.05 },
        { date: "2026-01-03", value: 0.05 },
        { date: "2026-01-04", value: 0.05 },
        { date: "2026-01-05", value: 0.05 },
      ],
      grid,
    );
    expect(indice[2]).toBeCloseTo(100 * Math.pow(1.0005, 4), 10);
  });

  it("sem série, fica parado em 100 em vez de sumir", () => {
    expect(buildCdiIndex([], grid)).toEqual([100, 100, 100]);
  });
});

describe("buildPriceIndex", () => {
  const grid = ["2026-01-01", "2026-01-02", "2026-01-03"];

  it("normaliza o fechamento pra base 100 no primeiro ponto", () => {
    const indice = buildPriceIndex(
      [
        { date: "2026-01-01", close: 120000 },
        { date: "2026-01-03", close: 132000 },
      ],
      grid,
    );
    expect(indice[0]).toBe(100);
    // 02/01 sem fechamento próprio carrega o de 01/01.
    expect(indice[1]).toBe(100);
    expect(indice[2]).toBeCloseTo(110, 10);
  });

  it("antes do primeiro dado a linha não existe, em vez de fingir um índice parado", () => {
    const indice = buildPriceIndex([{ date: "2026-01-03", close: 100 }], grid);
    expect(indice[0]).toBeNull();
    expect(indice[1]).toBeNull();
    expect(indice[2]).toBe(100);
  });

  it("série vazia devolve linha inteira nula (provedor fora do ar)", () => {
    expect(buildPriceIndex([], grid)).toEqual([null, null, null]);
  });
});

describe("buildFixedIncomeEvolution", () => {
  const cdiDiario = (from: string, dias: number) =>
    Array.from({ length: dias }, (_, i) => ({
      date: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
      value: 0.05,
    }));

  const indicadores = { cdiAnnualRate: 14.9, ipcaAnnualRate: 4.5 };

  function aplicacao(over: Partial<FixedIncomeSnapshot> = {}): FixedIncomeSnapshot {
    return {
      id: "f1",
      principalAmount: 10000,
      applicationDate: "2026-01-01",
      redeemedAt: null,
      redeemedNetAmount: null,
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      fixedRatePercent: null,
      cdiPercent: 100,
      currentNetValue: 10500,
      ...over,
    };
  }

  it("aplicação feita no meio da janela não vale nada antes da data de aplicação", () => {
    const grid = ["2026-01-01", "2026-02-01", "2026-03-01"];
    const pontos = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ applicationDate: "2026-02-01" })],
      cdiDiario("2026-01-01", 90),
      indicadores,
      "2026-03-01",
    );

    expect(pontos[0].value).toBe(0);
    expect(pontos[0].invested).toBe(0);
    expect(pontos[1].invested).toBe(10000);
    // O aporte entra como fluxo no ponto em que aconteceu — é o que impede o índice de tratar
    // dinheiro novo como rentabilidade.
    expect(pontos[1].flow).toBe(10000);
    expect(pontos[2].flow).toBe(0);
  });

  it("o último ponto usa o valor que a tela de Renda Fixa mostra, sem recalcular", () => {
    const grid = ["2026-01-01", "2026-03-01"];
    const pontos = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ currentNetValue: 10321.45 })],
      cdiDiario("2026-01-01", 90),
      indicadores,
      "2026-03-01",
    );

    expect(pontos[1].value).toBe(10321.45);
  });

  it("resgatada sai da soma na data do resgate e leva o dinheiro como fluxo negativo", () => {
    const grid = ["2026-01-01", "2026-02-01", "2026-03-01"];
    const pontos = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ redeemedAt: "2026-02-01", redeemedNetAmount: 10200 })],
      cdiDiario("2026-01-01", 90),
      indicadores,
      "2026-03-01",
    );

    expect(pontos[0].value).toBeGreaterThan(0);
    expect(pontos[1].value).toBe(0);
    expect(pontos[1].invested).toBe(0);
    expect(pontos[1].flow).toBe(-10200);
    expect(pontos[2].flow).toBe(0);
  });

  it("rende dia após dia a partir da série do CDI", () => {
    const grid = ["2026-01-01", "2026-01-15", "2026-02-01"];
    const pontos = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ currentNetValue: 99999 })],
      cdiDiario("2026-01-01", 60),
      indicadores,
      "2026-06-01",
    );

    expect(pontos[0].value).toBe(10000);
    expect(pontos[1].value).toBeGreaterThan(pontos[0].value);
    expect(pontos[2].value).toBeGreaterThan(pontos[1].value);
  });

  it('"130% do CDI" rende mais que 100% na mesma janela — o percentual entra na taxa diária', () => {
    const grid = ["2026-01-01", "2026-03-01"];
    const taxas = cdiDiario("2026-01-01", 90);

    const cem = buildFixedIncomeEvolution(grid, [aplicacao({ cdiPercent: 100, currentNetValue: 0 })], taxas, indicadores, "2026-06-01");
    const centoTrinta = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ cdiPercent: 130, currentNetValue: 0 })],
      taxas,
      indicadores,
      "2026-06-01",
    );

    expect(centoTrinta[1].value).toBeGreaterThan(cem[1].value);
  });

  it("a taxa do próprio dia da avaliação ainda não caiu — janela [aplicação, data)", () => {
    const grid = ["2026-01-01", "2026-01-02"];
    const pontos = buildFixedIncomeEvolution(
      grid,
      [aplicacao({ currentNetValue: 0 })],
      [{ date: "2026-01-01", value: 0.05 }],
      indicadores,
      "2026-06-01",
    );

    // O dia 01 é o da aplicação: a taxa dele só é creditada no dia 02.
    expect(pontos[0].value).toBe(10000);
    expect(pontos[1].value).toBeGreaterThan(10000);
  });

  it("LCI é isenta de IR e por isso rende mais que um CDB idêntico", () => {
    const grid = ["2026-01-01", "2026-06-01"];
    const taxas = cdiDiario("2026-01-01", 200);

    const cdb = buildFixedIncomeEvolution(grid, [aplicacao({ type: "CDB", currentNetValue: 0 })], taxas, indicadores, "2026-12-01");
    const lci = buildFixedIncomeEvolution(grid, [aplicacao({ type: "LCI", currentNetValue: 0 })], taxas, indicadores, "2026-12-01");

    expect(lci[1].value).toBeGreaterThan(cdb[1].value);
  });
});

describe("buildAssetEvolution — ativo sem histórico sai dos dois lados da conta", () => {
  // Bug real, pego na verificação contra a API: o ativo sem cotação ficava fora do valor mas o
  // dinheiro dele continuava no fluxo. O índice de retorno via o aporte entrar e nada aparecer, e
  // a classe inteira aparecia com −100% só porque o provedor de cotação estava fora do ar.
  it("não deixa o aporte do ativo excluído virar prejuízo no índice", () => {
    const grid = ["2026-01-01", "2026-02-01"];
    const { points, withoutHistory } = buildAssetEvolution(
      grid,
      [tx({ assetId: "sem", date: "2026-01-15", quantity: 100, unitPrice: 32.5, fees: 5 })],
      new Map(),
      new Map([["sem", "PETR4"]]),
    );

    expect(points.every((p) => p.value === 0 && p.invested === 0 && p.flow === 0)).toBe(true);
    expect(withoutHistory).toEqual(["PETR4"]);
    expect(buildReturnIndex(points)).toEqual([100, 100]);
  });

  it("o ativo com série continua contando normalmente ao lado do excluído", () => {
    const grid = ["2026-01-01", "2026-02-01"];
    const series = new Map<string, DatedClose[]>([["com", [{ date: "2026-01-15", close: 12 }]]]);

    const { points, withoutHistory } = buildAssetEvolution(
      grid,
      [
        tx({ assetId: "com", date: "2026-01-15", quantity: 10, unitPrice: 10 }),
        tx({ assetId: "sem", date: "2026-01-15", quantity: 100, unitPrice: 32.5 }),
      ],
      series,
      new Map([
        ["com", "VALE3"],
        ["sem", "PETR4"],
      ]),
    );

    expect(points[1].value).toBe(120);
    expect(points[1].invested).toBe(100);
    expect(points[1].flow).toBe(100);
    expect(withoutHistory).toEqual(["PETR4"]);
  });
});
