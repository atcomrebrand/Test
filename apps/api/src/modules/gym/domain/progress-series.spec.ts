import { bucketSessions, consistencyPercent, startOfWeek, summarizeWeek, targetProgress, weekDays } from "./progress-series";

const sess = (iso: string, volume = 1000, durationSeconds = 3600) => ({
  startedAt: new Date(iso), totalVolume: volume, durationSeconds,
});

describe("bucketSessions", () => {
  it("agrupa por semana começando no DOMINGO, como o calendário brasileiro", () => {
    // 27/08/2026 é uma quinta; a semana dela começa no domingo 23/08.
    expect(startOfWeek(new Date("2026-08-27T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-08-23");
    const b = bucketSessions([sess("2026-08-24T10:00:00Z"), sess("2026-08-27T10:00:00Z")], "WEEK");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ key: "2026-08-23", sessions: 2, volume: 2000, minutes: 120 });
  });

  it("domingo ABRE a semana, e não fecha a anterior", () => {
    // É o corte que a tirinha Dom→Sáb desenha: se a conta usasse outro, um treino de domingo
    // apareceria marcado numa semana e somaria na outra.
    expect(startOfWeek(new Date("2026-08-30T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(startOfWeek(new Date("2026-08-29T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-08-23");
  });

  it("semana sem treino aparece zerada quando há intervalo, porque o vazio É a informação", () => {
    const b = bucketSessions(
      [sess("2026-08-03T10:00:00Z")],
      "WEEK",
      new Date("2026-08-02T00:00:00Z"),
      new Date("2026-08-23T00:00:00Z"),
    );
    expect(b.map((p) => p.sessions)).toEqual([1, 0, 0, 0]);
  });

  it("agrupa por mês quando pedido", () => {
    const b = bucketSessions([sess("2026-07-30T10:00:00Z"), sess("2026-08-02T10:00:00Z")], "MONTH");
    expect(b.map((p) => p.key)).toEqual(["2026-07-01", "2026-08-01"]);
  });
});

describe("summarizeWeek", () => {
  it("conta só a semana da referência", () => {
    const s = summarizeWeek(
      [sess("2026-08-24T10:00:00Z"), sess("2026-08-26T10:00:00Z"), sess("2026-08-20T10:00:00Z")],
      new Date("2026-08-27T12:00:00Z"),
      5,
    );
    expect(s).toMatchObject({ done: 2, target: 5, minutes: 120 });
  });
});

describe("weekDays", () => {
  it("devolve sempre sete dias, de domingo a sábado", () => {
    const dias = weekDays([], new Date("2026-08-27T12:00:00Z"));
    expect(dias).toHaveLength(7);
    expect(dias[0].date).toBe("2026-08-23");
    expect(dias[6].date).toBe("2026-08-29");
    expect(dias.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("marca o dia que teve treino e deixa o resto em zero", () => {
    const dias = weekDays(
      [sess("2026-08-24T10:00:00Z", 1500), sess("2026-08-24T19:00:00Z", 500), sess("2026-08-27T10:00:00Z")],
      new Date("2026-08-27T12:00:00Z"),
    );
    // Dois treinos na segunda contam dois, e o volume soma.
    expect(dias[1]).toMatchObject({ date: "2026-08-24", sessions: 2, volume: 2000 });
    expect(dias[4]).toMatchObject({ date: "2026-08-27", sessions: 1 });
    expect(dias.filter((d) => d.sessions === 0)).toHaveLength(5);
  });

  it("ignora treino de outra semana", () => {
    const dias = weekDays([sess("2026-08-20T10:00:00Z")], new Date("2026-08-27T12:00:00Z"));
    expect(dias.every((d) => d.sessions === 0)).toBe(true);
  });
});

describe("consistencyPercent", () => {
  it("ignora a semana corrente, que sempre começaria em 0", () => {
    const semanas = [
      { key: "2026-08-03", sessions: 5, volume: 0, minutes: 0 },
      { key: "2026-08-10", sessions: 3, volume: 0, minutes: 0 },
      { key: "2026-08-24", sessions: 0, volume: 0, minutes: 0 },
    ];
    // Sem o recorte, na segunda-feira a consistência cairia de 50% pra 33% sem ninguém treinar pior.
    expect(consistencyPercent(semanas, 5, "2026-08-24")).toBe(50);
  });

  it("sem semana completa é nulo, não zero", () => {
    expect(consistencyPercent([{ key: "2026-08-24", sessions: 1, volume: 0, minutes: 0 }], 5, "2026-08-24")).toBeNull();
  });
});

describe("targetProgress", () => {
  it("mede a partir do ponto de partida, não do zero", () => {
    // 80 → 100 kg, está em 82,5: 12,5% do caminho, não 82,5%.
    expect(targetProgress(82.5, 100, 80)).toBe(12.5);
  });

  it("sem ponto de partida mede do zero", () => {
    expect(targetProgress(82.5, 100, null)).toBe(82.5);
  });

  it("não passa de 100 nem fica negativo", () => {
    expect(targetProgress(120, 100, 80)).toBe(100);
    expect(targetProgress(70, 100, 80)).toBe(0);
  });

  it("meta de emagrecer conta pro lado certo", () => {
    // 90 kg mirando 80: em 85 está na metade, mesmo o alvo sendo MENOR que a partida.
    expect(targetProgress(85, 80, 90)).toBe(50);
  });
});
