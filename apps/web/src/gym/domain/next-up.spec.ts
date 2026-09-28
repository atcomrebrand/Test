import { describe, expect, it } from "vitest";
import { nextUp } from "./next-up";

const serie = (n: number, completed = false) => ({ setNumber: n, completed });

const ficha = () => [
  { name: "Supino reto", sets: [serie(1, true), serie(2), serie(3)] },
  { name: "Crucifixo", sets: [serie(1), serie(2)] },
  { name: "Tríceps pulley", sets: [serie(1), serie(2)] },
];

describe("nextUp", () => {
  it("no meio do exercício, aponta a próxima série dele", () => {
    expect(nextUp(ficha(), 0)).toEqual({ kind: "SET", exerciseName: "Supino reto", setNumber: 2, totalSets: 3 });
  });

  it("terminado o exercício, aponta o PRÓXIMO exercício e a primeira série dele", () => {
    const f = ficha();
    f[0].sets = [serie(1, true), serie(2, true), serie(3, true)];
    expect(nextUp(f, 0)).toEqual({ kind: "EXERCISE", exerciseName: "Crucifixo", setNumber: 1, totalSets: 2 });
  });

  it("pula exercício já concluído pra chegar no que falta", () => {
    const f = ficha();
    f[0].sets = [serie(1, true), serie(2, true), serie(3, true)];
    f[1].sets = [serie(1, true), serie(2, true)];
    expect(nextUp(f, 0)).toMatchObject({ kind: "EXERCISE", exerciseName: "Tríceps pulley" });
  });

  it("volta pro que ficou pra trás em vez de dizer que acabou", () => {
    // Pulou o supino e fez o resto: ainda há série pendente, e "acabou" seria mentira.
    const f = ficha();
    f[1].sets = [serie(1, true), serie(2, true)];
    f[2].sets = [serie(1, true), serie(2, true)];
    expect(nextUp(f, 2)).toMatchObject({ kind: "EXERCISE", exerciseName: "Supino reto", setNumber: 2 });
  });

  it("mas a frente tem prioridade sobre o que ficou pra trás", () => {
    // O exercício atual acabou, e sobrou pendência dos DOIS lados: o de trás (supino) e o da
    // frente (tríceps). Quem manda é a ordem da ficha.
    const f = ficha();
    f[1].sets = [serie(1, true), serie(2, true)];
    expect(nextUp(f, 1)).toMatchObject({ kind: "EXERCISE", exerciseName: "Tríceps pulley" });
  });

  it("com tudo concluído, não há próxima", () => {
    const f = ficha().map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, completed: true })) }));
    expect(nextUp(f, 2)).toEqual({ kind: "END" });
  });

  it("a última série do último exercício ainda é 'mais uma série', não 'acabou'", () => {
    const f = ficha();
    f[0].sets = f[0].sets.map((s) => ({ ...s, completed: true }));
    f[1].sets = f[1].sets.map((s) => ({ ...s, completed: true }));
    f[2].sets = [serie(1, true), serie(2)];
    expect(nextUp(f, 2)).toEqual({ kind: "SET", exerciseName: "Tríceps pulley", setNumber: 2, totalSets: 2 });
  });

  it("índice fora da lista não quebra", () => {
    expect(nextUp(ficha(), 99)).toMatchObject({ kind: "EXERCISE", exerciseName: "Supino reto" });
    expect(nextUp([], 0)).toEqual({ kind: "END" });
  });
});
