import { pickNextWorkout } from "./next-workout";

const FICHAS = [
  { id: "a", order: 0, lastPerformedAt: "2026-08-25T10:00:00Z" },
  { id: "b", order: 1, lastPerformedAt: "2026-08-26T10:00:00Z" },
  { id: "c", order: 2, lastPerformedAt: "2026-08-27T10:00:00Z" },
  { id: "d", order: 3, lastPerformedAt: "2026-08-24T10:00:00Z" },
];

describe("pickNextWorkout", () => {
  it("depois do A vem o B — o rodízio segue a ordem da lista", () => {
    expect(pickNextWorkout(FICHAS, "a")!.id).toBe("b");
    expect(pickNextWorkout(FICHAS, "b")!.id).toBe("c");
    expect(pickNextWorkout(FICHAS, "c")!.id).toBe("d");
  });

  it("depois do último volta pro primeiro", () => {
    expect(pickNextWorkout(FICHAS, "d")!.id).toBe("a");
  });

  it("a sequência ganha da data, que é onde a regra antiga errava", () => {
    // O "há mais tempo parado" apontaria o D (24/08). Mas quem acabou de fazer o A espera o B.
    expect(pickNextWorkout(FICHAS, "a")!.id).toBe("b");
  });

  it("repetir a mesma ficha duas vezes não trava o rodízio", () => {
    expect(pickNextWorkout(FICHAS, "c")!.id).toBe("d");
  });

  it("sem treino nenhum ainda, começa pelo primeiro da lista", () => {
    const novas = FICHAS.map((f) => ({ ...f, lastPerformedAt: null }));
    expect(pickNextWorkout(novas, null)!.id).toBe("a");
  });

  it("com parte das fichas nunca feita, sugere a primeira nunca feita", () => {
    const mistas = [
      { id: "a", order: 0, lastPerformedAt: "2026-08-25T10:00:00Z" },
      { id: "b", order: 1, lastPerformedAt: null },
      { id: "c", order: 2, lastPerformedAt: null },
    ];
    expect(pickNextWorkout(mistas, null)!.id).toBe("b");
  });

  it("última ficha arquivada cai no plano B, sem quebrar", () => {
    // Fez um treino de uma ficha que depois foi arquivada: não há "próxima" a partir do que sumiu.
    expect(pickNextWorkout(FICHAS, "ficha-que-nao-existe-mais")!.id).toBe("d");
  });

  it("respeita a ordem escolhida, não a ordem em que vieram do banco", () => {
    const embaralhadas = [FICHAS[2], FICHAS[0], FICHAS[3], FICHAS[1]];
    expect(pickNextWorkout(embaralhadas, "a")!.id).toBe("b");
  });

  it("sem ficha nenhuma devolve nulo", () => {
    expect(pickNextWorkout([], "a")).toBeNull();
  });

  it("uma ficha só sempre aponta pra ela mesma", () => {
    const uma = [{ id: "a", order: 0, lastPerformedAt: "2026-08-25T10:00:00Z" }];
    expect(pickNextWorkout(uma, "a")!.id).toBe("a");
  });
});
