import { bestOneRm, estimateWorkoutSeconds, summarizeSession, volumeByExercise } from "./session-metrics";

const INICIO = new Date("2026-08-27T10:00:00Z");
const FIM = new Date("2026-08-27T10:55:00Z");

function serie(over: Partial<Parameters<typeof summarizeSession>[0][number]> = {}) {
  return { exerciseId: "e1", setNumber: 1, weight: 80, reps: 8, completed: true, ...over } as any;
}

describe("summarizeSession", () => {
  it("soma volume só das séries concluídas", () => {
    const m = summarizeSession(
      [serie(), serie({ setNumber: 2 }), serie({ setNumber: 3, completed: false })],
      INICIO,
      FIM,
    );
    // A terceira foi planejada e não realizada: 2 × 640, não 3.
    expect(m.totalVolume).toBe(1280);
    expect(m.completedSets).toBe(2);
    expect(m.plannedSets).toBe(3);
  });

  it("mede a duração por relógio, não pela soma das partes", () => {
    expect(summarizeSession([serie()], INICIO, FIM).durationSeconds).toBe(55 * 60);
    expect(summarizeSession([serie()], INICIO, null).durationSeconds).toBeNull();
  });

  it("a média de descanso divide pelas séries que DESCANSARAM, não por todas", () => {
    const m = summarizeSession(
      [
        serie({ restActualSeconds: 90 }),
        serie({ setNumber: 2, restActualSeconds: 110 }),
        // Última do exercício: não descansou. Se entrasse no divisor, a média cairia pra 66s.
        serie({ setNumber: 3 }),
      ],
      INICIO,
      FIM,
    );
    expect(m.totalRestSeconds).toBe(200);
    expect(m.averageRestSeconds).toBe(100);
  });

  it("separa o tempo executando do tempo descansando", () => {
    const m = summarizeSession([serie({ restActualSeconds: 600 })], INICIO, FIM);
    expect(m.workingSeconds).toBe(55 * 60 - 600);
  });

  it("descanso pulado é contado, porque é justamente o que se quer olhar depois", () => {
    const m = summarizeSession([serie({ restWasSkipped: true, restActualSeconds: 4 })], INICIO, FIM);
    expect(m.skippedRests).toBe(1);
  });

  it("sessão sem descanso nenhum tem média nula, não zero", () => {
    // Zero diria "descansou nada"; nulo diz "não há o que medir".
    expect(summarizeSession([serie()], INICIO, FIM).averageRestSeconds).toBeNull();
  });
});

describe("volumeByExercise", () => {
  it("agrupa por exercício e ignora série não concluída", () => {
    const v = volumeByExercise([
      { exerciseId: "a", setNumber: 1, weight: 100, reps: 5, completed: true },
      { exerciseId: "a", setNumber: 2, weight: 100, reps: 5, completed: false },
      { exerciseId: "b", setNumber: 1, weight: 20, reps: 12, completed: true },
    ]);
    expect(v.get("a")).toBe(500);
    expect(v.get("b")).toBe(240);
  });
});

describe("estimateWorkoutSeconds", () => {
  it("não cobra o descanso que vem depois da última série do treino", () => {
    const um = estimateWorkoutSeconds([{ sets: 2, targetRepsMin: 10, targetRepsMax: 10, restSeconds: 60 }]);
    // 2 séries × 35s de execução + 1 descanso de 60s. O descanso final não existe.
    expect(um).toBe(130);
  });

  it("uma série de 5 leva menos que uma de 15, porque a execução conta por repetição", () => {
    const curta = estimateWorkoutSeconds([{ sets: 3, targetRepsMin: 5, targetRepsMax: 5, restSeconds: 90 }]);
    const longa = estimateWorkoutSeconds([{ sets: 3, targetRepsMin: 15, targetRepsMax: 15, restSeconds: 90 }]);
    expect(longa).toBeGreaterThan(curta);
  });

  it("treino vazio dura zero, não um número negativo", () => {
    expect(estimateWorkoutSeconds([])).toBe(0);
  });
});

describe("bestOneRm", () => {
  it("pega o melhor entre as séries, que nem sempre é a mais pesada", () => {
    // 80×8 estima 101,33; 90×3 estima 99. A série mais pesada NÃO é o melhor 1RM.
    const melhor = bestOneRm(
      [
        { exerciseId: "a", setNumber: 1, weight: 80, reps: 8, completed: true },
        { exerciseId: "a", setNumber: 2, weight: 90, reps: 3, completed: true },
      ],
      "EPLEY",
    );
    expect(melhor).toBe(101.33);
  });
});
