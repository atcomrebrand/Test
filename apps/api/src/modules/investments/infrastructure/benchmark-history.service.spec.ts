import { BenchmarkHistoryService, benchmarkRangeFor, parseBrapiHistory, parseYahooHistory, resolveQuoteDate } from "./benchmark-history.service";

describe("parseBrapiHistory", () => {
  // Payload real do `/api/quote/^BVSP?range=3mo&interval=1d`, copiado da VPS em 2026-08-23 — a
  // fonte passou a ser a BRAPI porque o Yahoo devolve 429 pro IP de lá.
  const REAL = {
    results: [
      {
        historicalDataPrice: [
          { date: 1779764400, open: 177816, high: 177816, low: 175516, close: 176589, volume: 7402600, adjustedClose: 176589 },
          { date: 1779850800, open: 176589, high: 178000, low: 176000, close: 177200, volume: 6900000, adjustedClose: 177200 },
        ],
      },
    ],
  };

  it("lê data e fechamento do formato que a BRAPI publica", () => {
    // 1779764400 é 26/05/2026 03:00 UTC — meia-noite de Brasília, que é o carimbo do pregão.
    expect(parseBrapiHistory(REAL)).toEqual([
      { date: "2026-05-26", close: 176589 },
      { date: "2026-05-27", close: 177200 },
    ]);
  });

  it("prefere o adjustedClose quando os dois vêm", () => {
    const ajustado = parseBrapiHistory({
      results: [{ historicalDataPrice: [{ date: 1779764400, close: 100, adjustedClose: 95 }] }],
    });
    expect(ajustado[0].close).toBe(95);
  });

  it("cai no close quando não há adjustedClose", () => {
    const bruto = parseBrapiHistory({ results: [{ historicalDataPrice: [{ date: 1779764400, close: 100 }] }] });
    expect(bruto[0].close).toBe(100);
  });

  it("pula o feriado em vez de gravar um dia em que o índice foi a zero", () => {
    const comBuraco = parseBrapiHistory({
      results: [
        {
          historicalDataPrice: [
            { date: 1779764400, close: 176589 },
            { date: 1779850800, close: undefined },
            { date: 1779937200, close: 177200 },
          ],
        },
      ],
    });
    expect(comBuraco).toHaveLength(2);
    expect(comBuraco.map((p) => p.close)).toEqual([176589, 177200]);
  });

  it("resposta sem resultado nenhum é série vazia, não exceção", () => {
    expect(parseBrapiHistory({})).toEqual([]);
    expect(parseBrapiHistory({ results: [] })).toEqual([]);
    expect(parseBrapiHistory({ results: [{}] })).toEqual([]);
  });
});

describe("parseYahooHistory", () => {
  it("casa timestamp com fechamento pelo índice", () => {
    const serie = parseYahooHistory({
      chart: {
        result: [
          {
            timestamp: [1779764400, 1779850800],
            indicators: { quote: [{ close: [176589, 177200] }] },
          },
        ],
      },
    });
    expect(serie).toEqual([
      { date: "2026-05-26", close: 176589 },
      { date: "2026-05-27", close: 177200 },
    ]);
  });

  it("null no meio da série é feriado: sai fora sem deslocar as outras datas", () => {
    const serie = parseYahooHistory({
      chart: {
        result: [
          {
            timestamp: [1779764400, 1779850800, 1779937200],
            indicators: { quote: [{ close: [176589, null, 177200] }] },
          },
        ],
      },
    });
    expect(serie).toEqual([
      { date: "2026-05-26", close: 176589 },
      { date: "2026-05-28", close: 177200 },
    ]);
  });

  it("resposta vazia não vira exceção", () => {
    expect(parseYahooHistory({ chart: {} })).toEqual([]);
  });
});

describe("benchmarkRangeFor", () => {
  it("pede sempre uma janela maior que a pedida, nunca menor", () => {
    expect(benchmarkRangeFor(30)).toBe("3mo");
    expect(benchmarkRangeFor(92)).toBe("6mo");
    expect(benchmarkRangeFor(183)).toBe("1y");
    expect(benchmarkRangeFor(365)).toBe("2y");
  });
});

describe("resolveQuoteDate", () => {
  // 24/08/2026 é uma segunda; 22 e 23 são sábado e domingo.
  const SEGUNDA_19H = new Date("2026-08-24T22:00:00Z");

  it("quando a fonte informa o instante do negócio, é ele que manda", () => {
    expect(resolveQuoteDate("2026-08-21T20:15:00Z", SEGUNDA_19H)).toBe("2026-08-21");
  });

  it("aceita epoch em segundos, do jeito que a BRAPI publica no histórico", () => {
    expect(resolveQuoteDate(1779764400, SEGUNDA_19H)).toBe("2026-05-26");
  });

  it("feriado não inventa pregão: a cotação repete a sexta e é na sexta que ela é gravada", () => {
    // Rodando numa segunda de feriado, a fonte devolve o último negócio, que foi na sexta.
    expect(resolveQuoteDate("2026-08-21T20:15:00Z", SEGUNDA_19H)).toBe("2026-08-21");
    expect(resolveQuoteDate("2026-08-21T20:15:00Z", SEGUNDA_19H)).not.toBe("2026-08-24");
  });

  it("sem o instante do negócio, cai na regra do dia útil", () => {
    expect(resolveQuoteDate(undefined, SEGUNDA_19H)).toBe("2026-08-24");
  });

  it("fim de semana não vira ponto da série", () => {
    expect(resolveQuoteDate(undefined, new Date("2026-08-22T22:00:00Z"))).toBeNull();
    expect(resolveQuoteDate(undefined, new Date("2026-08-23T22:00:00Z"))).toBeNull();
  });

  it("quem manda é o calendário do Brasil, não o do servidor", () => {
    // 25/08 02h UTC é 23h de segunda em Brasília: o pregão foi o de segunda, não o de terça.
    expect(resolveQuoteDate(undefined, new Date("2026-08-25T02:00:00Z"))).toBe("2026-08-24");
  });

  it("instante ilegível não trava o job: volta pra regra do dia útil", () => {
    expect(resolveQuoteDate("banana", SEGUNDA_19H)).toBe("2026-08-24");
    expect(resolveQuoteDate("", SEGUNDA_19H)).toBe("2026-08-24");
  });
});

describe("BenchmarkHistoryService.recordDailyClose", () => {
  const SEGUNDA_19H = new Date("2026-08-24T22:00:00Z");
  const originalFetch = global.fetch;

  function comResposta(body: unknown, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
  }

  function servico(createMany = jest.fn().mockResolvedValue({ count: 1 })) {
    const prisma = { historicalPrice: { createMany } };
    return { service: new BenchmarkHistoryService(prisma as never), createMany };
  }

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("guarda a cotação do dia sob o ticker do índice", async () => {
    comResposta({ results: [{ regularMarketPrice: 3682.02, regularMarketTime: "2026-08-24T20:15:00Z" }] });
    const { service, createMany } = servico();

    await expect(service.recordDailyClose("IFIX", SEGUNDA_19H)).resolves.toBe("gravado");
    expect(createMany).toHaveBeenCalledWith({
      data: [{ ticker: "^IFIX", date: new Date("2026-08-24T00:00:00Z"), close: 3682.02 }],
      skipDuplicates: true,
    });
  });

  it("rodar duas vezes no mesmo pregão não sobrescreve o fechamento já guardado", async () => {
    comResposta({ results: [{ regularMarketPrice: 3682.02, regularMarketTime: "2026-08-24T20:15:00Z" }] });
    const { service } = servico(jest.fn().mockResolvedValue({ count: 0 }));

    await expect(service.recordDailyClose("IFIX", SEGUNDA_19H)).resolves.toBe("repetido");
  });

  it("fim de semana sem instante de negócio não grava nada", async () => {
    comResposta({ results: [{ regularMarketPrice: 3682.02 }] });
    const { service, createMany } = servico();

    await expect(service.recordDailyClose("IFIX", new Date("2026-08-22T22:00:00Z"))).resolves.toBe("fora-do-pregao");
    expect(createMany).not.toHaveBeenCalled();
  });

  it("sem cotação não grava — zero seria um dia em que o índice desapareceu", async () => {
    comResposta({ results: [{ regularMarketPrice: 0 }] });
    const { service, createMany } = servico();

    await expect(service.recordDailyClose("IFIX", SEGUNDA_19H)).resolves.toBe("sem-cotacao");
    expect(createMany).not.toHaveBeenCalled();
  });

  it("fonte fora do ar devolve status, não exceção — o job tem que seguir pro próximo índice", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    const { service, createMany } = servico();

    await expect(service.recordDailyClose("IFIX", SEGUNDA_19H)).resolves.toBe("sem-cotacao");
    expect(createMany).not.toHaveBeenCalled();
  });
});
