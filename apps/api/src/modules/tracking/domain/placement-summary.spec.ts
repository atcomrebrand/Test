import { parsePlacementInput, summarizePlacements } from "./placement-summary";

const dia = (date: string, placement: number | null, satisfactionPercent: number | null, responseMinutes: number | null) => ({
  date,
  placement,
  satisfactionPercent,
  responseMinutes,
});

describe("summarizePlacements", () => {
  it("o melhor de posição e tempo é o MENOR; o de satisfação é o maior", () => {
    const r = summarizePlacements([dia("2026-08-01", 12, 88, 9), dia("2026-08-02", 3, 96.5, 4)]);

    expect(r.placement!.best).toBe(3);
    expect(r.responseMinutes!.best).toBe(4);
    expect(r.satisfaction!.best).toBe(96.5);
  });

  it("melhorar a posição dá tendência POSITIVA, mesmo o número tendo caído", () => {
    // Sair de 12º e chegar a 1º é a maior evolução possível. Uma tendência que fizesse
    // último − primeiro devolveria −11 e a tela leria como piora.
    const r = summarizePlacements([dia("2026-08-01", 12, null, null), dia("2026-08-02", 1, null, null)]);
    expect(r.placement!.trend).toBe(11);
  });

  it("na satisfação a tendência segue o sinal natural", () => {
    const r = summarizePlacements([dia("2026-08-01", null, 80, null), dia("2026-08-02", null, 95, null)]);
    expect(r.satisfaction!.trend).toBe(15);
  });

  it("ordena por data antes de medir a tendência", () => {
    // O dado pode chegar em qualquer ordem do banco; a tendência é do primeiro ao último DIA.
    const r = summarizePlacements([dia("2026-08-05", 2, null, null), dia("2026-08-01", 10, null, null)]);
    expect(r.placement!.trend).toBe(8);
  });

  it("dia sem o número não entra na média daquela métrica", () => {
    // Contar ausência como zero criaria uma colocação melhor que o primeiro lugar.
    const r = summarizePlacements([dia("2026-08-01", 4, null, null), dia("2026-08-02", null, 90, null), dia("2026-08-03", 6, null, null)]);

    expect(r.placement!.days).toBe(2);
    expect(r.placement!.average).toBe(5);
    expect(r.placement!.best).toBe(4);
    expect(r.satisfaction!.days).toBe(1);
  });

  it("um dia só não tem tendência", () => {
    const r = summarizePlacements([dia("2026-08-01", 3, null, null)]);
    expect(r.placement!.trend).toBeNull();
  });

  it("métrica sem nenhum dado vem nula, não zerada", () => {
    const r = summarizePlacements([dia("2026-08-01", 3, null, null)]);
    expect(r.satisfaction).toBeNull();
    expect(r.responseMinutes).toBeNull();
  });

  it("conta como dia com dado quem tem QUALQUER um dos três", () => {
    const r = summarizePlacements([dia("2026-08-01", null, null, 5), dia("2026-08-02", null, null, null)]);
    expect(r.daysWithData).toBe(1);
  });

  it("lista vazia não quebra", () => {
    expect(summarizePlacements([])).toEqual({ placement: null, satisfaction: null, responseMinutes: null, daysWithData: 0 });
  });
});

describe("parsePlacementInput", () => {
  it("aceita os três preenchidos", () => {
    const r = parsePlacementInput({ placement: 3, satisfactionPercent: 97.5, responseMinutes: 4 });
    expect(r).toEqual({ ok: true, value: { placement: 3, satisfactionPercent: 97.5, responseMinutes: 4 } });
  });

  it("campo ausente NÃO entra no resultado — 'não mexi' não pode virar 'apague'", () => {
    // Foi bug real, pego no curl: mandar só `{placement: null}` pra tirar uma colocação lançada
    // errada apagava a satisfação e o tempo de resposta junto, porque os três eram normalizados
    // pra null. Só entra no resultado o que veio na requisição.
    const r = parsePlacementInput({ placement: null });
    expect(r.ok && r.value).toEqual({ placement: null });
  });

  it("nada informado devolve objeto vazio, não três nulos", () => {
    expect(parsePlacementInput({})).toEqual({ ok: true, value: {} });
  });

  it("aceita responder só parte", () => {
    const r = parsePlacementInput({ placement: 1 });
    expect(r.ok && r.value).toEqual({ placement: 1 });
  });

  it("null explícito apaga, e só naquele campo", () => {
    const r = parsePlacementInput({ placement: null, satisfactionPercent: 90 });
    expect(r.ok && r.value).toEqual({ placement: null, satisfactionPercent: 90 });
  });

  it("recusa colocação 0 e negativa", () => {
    expect(parsePlacementInput({ placement: 0 }).ok).toBe(false);
    expect(parsePlacementInput({ placement: -1 }).ok).toBe(false);
  });

  it("recusa colocação quebrada", () => {
    expect(parsePlacementInput({ placement: 2.5 }).ok).toBe(false);
  });

  it("aceita tempo de resposta ZERO — resposta instantânea é valor de verdade", () => {
    const r = parsePlacementInput({ responseMinutes: 0 });
    expect(r.ok && r.value).toEqual({ responseMinutes: 0 });
  });

  it("recusa tempo de resposta negativo ou quebrado", () => {
    expect(parsePlacementInput({ responseMinutes: -1 }).ok).toBe(false);
    expect(parsePlacementInput({ responseMinutes: 1.5 }).ok).toBe(false);
  });

  it("recusa satisfação fora de 0–100", () => {
    expect(parsePlacementInput({ satisfactionPercent: 101 }).ok).toBe(false);
    expect(parsePlacementInput({ satisfactionPercent: -0.1 }).ok).toBe(false);
  });

  it("aceita os extremos da satisfação", () => {
    expect(parsePlacementInput({ satisfactionPercent: 0 }).ok).toBe(true);
    expect(parsePlacementInput({ satisfactionPercent: 100 }).ok).toBe(true);
  });

  it("arredonda a satisfação em duas casas, como a coluna guarda", () => {
    const r = parsePlacementInput({ satisfactionPercent: 96.666 });
    expect(r.ok && r.value.satisfactionPercent).toBe(96.67);
  });
});
