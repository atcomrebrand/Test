import { benchmarkRangeFor, parseBrapiHistory, parseYahooHistory } from "./benchmark-history.service";

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
