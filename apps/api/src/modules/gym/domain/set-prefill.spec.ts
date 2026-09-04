import { lastPerformanceLabel, prefillSets } from "./set-prefill";

const plano = { exerciseId: "supino", sets: 4, targetRepsMin: 8, targetRepsMax: 10, targetWeight: 70, restSeconds: 90 };

describe("prefillSets", () => {
  it("repete o que foi feito da última vez, série por série", () => {
    const p = prefillSets(plano, [
      { setNumber: 1, weight: 80, reps: 8 },
      { setNumber: 2, weight: 80, reps: 8 },
      { setNumber: 3, weight: 80, reps: 7 },
      { setNumber: 4, weight: 80, reps: 6 },
    ]);
    expect(p.map((s) => `${s.weight}x${s.reps}`)).toEqual(["80x8", "80x8", "80x7", "80x6"]);
    expect(p.every((s) => s.fromHistory)).toBe(true);
  });

  it("na estreia usa a meta da ficha, com o PISO da faixa de repetições", () => {
    // Preencher com o topo (10) faria a série nascer "falhada" quando a pessoa fizesse os 8
    // esperados.
    const p = prefillSets(plano);
    expect(p[0]).toMatchObject({ weight: 70, reps: 8, fromHistory: false });
    expect(p).toHaveLength(4);
  });

  it("sem meta e sem histórico, o peso nasce zerado pra ser digitado", () => {
    const p = prefillSets({ ...plano, targetWeight: null });
    expect(p[0].weight).toBe(0);
  });

  it("série a mais na ficha repete a última conhecida, em vez de voltar pra meta", () => {
    // Fez 3 séries a 80 kg da última vez e a ficha agora pede 4: a quarta é 80, não os 70 da meta.
    const p = prefillSets(plano, [
      { setNumber: 1, weight: 80, reps: 8 },
      { setNumber: 2, weight: 80, reps: 8 },
      { setNumber: 3, weight: 80, reps: 8 },
    ]);
    expect(p[3]).toMatchObject({ weight: 80, reps: 8, fromHistory: true });
  });

  it("carrega o descanso configurado pra cada série", () => {
    expect(prefillSets({ ...plano, restSeconds: 45 })[0].restSeconds).toBe(45);
  });
});

describe("lastPerformanceLabel", () => {
  it("mostra a série mais pesada da última vez", () => {
    expect(lastPerformanceLabel([{ setNumber: 1, weight: 80, reps: 8 }, { setNumber: 2, weight: 82.5, reps: 6 }]))
      .toBe("82,5 kg × 6");
  });

  it("some quando é a estreia", () => {
    expect(lastPerformanceLabel([])).toBeNull();
  });
});
