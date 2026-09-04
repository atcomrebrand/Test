import { MuscleSetInput, summarizeMuscleLoad } from "./muscle-load";

const HOJE = "2026-08-20";

function set(over: Partial<MuscleSetInput> = {}): MuscleSetInput {
  return {
    date: HOJE,
    sessionId: "s1",
    exerciseId: "e1",
    exerciseName: "Supino reto",
    primaryMuscle: "PEITO",
    secondaryMuscles: [],
    weight: 60,
    reps: 10,
    ...over,
  };
}

const de = (r: ReturnType<typeof summarizeMuscleLoad>, m: string) => r.find((x) => x.muscle === m)!;

describe("summarizeMuscleLoad", () => {
  it("devolve os doze músculos sempre, mesmo os nunca treinados", () => {
    const r = summarizeMuscleLoad([set()], 7, HOJE);
    expect(r).toHaveLength(12);
    expect(de(r, "PANTURRILHAS").intensity).toBe("NENHUM");
    expect(de(r, "PANTURRILHAS").lastTrainedAt).toBeNull();
  });

  it("músculo secundário conta MEIA série", () => {
    // Supino é peito, mas também é tríceps: contar só o primário afirmaria que a pessoa nunca
    // treina tríceps quando ela treina em todo empurrar.
    const r = summarizeMuscleLoad([set({ secondaryMuscles: ["TRICEPS", "OMBROS"] })], 7, HOJE);

    expect(de(r, "PEITO").sets).toBe(1);
    expect(de(r, "TRICEPS").sets).toBe(0.5);
    expect(de(r, "OMBROS").sets).toBe(0.5);
  });

  it("músculo repetido como secundário do próprio primário não conta duas vezes", () => {
    const r = summarizeMuscleLoad([set({ secondaryMuscles: ["PEITO"] })], 7, HOJE);
    expect(de(r, "PEITO").sets).toBe(1);
  });

  it("QUILOS não decidem a cor — o leg press não pode ficar vermelho por ser leg press", () => {
    // Uma série de leg press pesadíssima contra dez séries de elevação lateral. Em volume, a perna
    // ganha de longe; em treino de verdade, quem foi treinado foi o ombro.
    const sets: MuscleSetInput[] = [
      set({ primaryMuscle: "QUADRICEPS", exerciseName: "Leg press", weight: 300, reps: 12 }),
      ...Array.from({ length: 10 }, (_, i) =>
        set({ primaryMuscle: "OMBROS", exerciseName: "Elevação lateral", weight: 8, reps: 12, sessionId: `s${i}` }),
      ),
    ];
    const r = summarizeMuscleLoad(sets, 7, HOJE);

    expect(de(r, "QUADRICEPS").volume).toBeGreaterThan(de(r, "OMBROS").volume);
    expect(de(r, "QUADRICEPS").intensity).toBe("POUCO");
    expect(de(r, "OMBROS").intensity).toBe("MEDIO");
  });

  it("classifica em pouco, médio e muito pelas séries da semana", () => {
    const nSeries = (n: number, muscle: MuscleSetInput["primaryMuscle"]) =>
      Array.from({ length: n }, () => set({ primaryMuscle: muscle }));

    const r = summarizeMuscleLoad([...nSeries(5, "PEITO"), ...nSeries(12, "COSTAS"), ...nSeries(22, "QUADRICEPS")], 7, HOJE);

    expect(de(r, "PEITO").intensity).toBe("POUCO");
    expect(de(r, "COSTAS").intensity).toBe("MEDIO");
    expect(de(r, "QUADRICEPS").intensity).toBe("MUITO");
  });

  it("as faixas acompanham a janela — 10 séries em 30 dias não é volume médio", () => {
    const dez = Array.from({ length: 10 }, () => set());

    expect(de(summarizeMuscleLoad(dez, 7, HOJE), "PEITO").intensity).toBe("MEDIO");
    expect(de(summarizeMuscleLoad(dez, 30, HOJE), "PEITO").intensity).toBe("POUCO");
  });

  it("série fora da janela não conta pro volume", () => {
    const r = summarizeMuscleLoad([set({ date: "2026-08-01" })], 7, HOJE);
    expect(de(r, "PEITO").sets).toBe(0);
    expect(de(r, "PEITO").intensity).toBe("NENHUM");
  });

  it("mas o ÚLTIMO TREINO olha o histórico inteiro, não a janela", () => {
    // "Faz quanto tempo que não treino isso" é a pergunta do modo Atenção, e ela não pode ser
    // limitada pelo período escolhido na tela: senão um músculo parado há 3 meses e um nunca
    // treinado ficariam iguais.
    const r = summarizeMuscleLoad([set({ date: "2026-06-20" })], 7, HOJE);

    expect(de(r, "PEITO").sets).toBe(0);
    expect(de(r, "PEITO").lastTrainedAt).toBe("2026-06-20");
    expect(de(r, "PEITO").daysSince).toBe(61);
  });

  it("treinado hoje é zero dia sem treinar", () => {
    const r = summarizeMuscleLoad([set()], 7, HOJE);
    expect(de(r, "PEITO").daysSince).toBe(0);
  });

  it("a janela inclui o primeiro dia dela", () => {
    // Janela de 7 dias terminando em 20/08 começa em 14/08, não em 13.
    expect(de(summarizeMuscleLoad([set({ date: "2026-08-14" })], 7, HOJE), "PEITO").sets).toBe(1);
    expect(de(summarizeMuscleLoad([set({ date: "2026-08-13" })], 7, HOJE), "PEITO").sets).toBe(0);
  });

  it("conta treinos distintos, não séries", () => {
    const r = summarizeMuscleLoad([set({ sessionId: "a" }), set({ sessionId: "a" }), set({ sessionId: "b" })], 7, HOJE);
    expect(de(r, "PEITO").sessions).toBe(2);
    expect(de(r, "PEITO").sets).toBe(3);
  });

  it("guarda a maior carga da janela e em qual exercício", () => {
    const r = summarizeMuscleLoad(
      [set({ weight: 60, exerciseName: "Supino reto" }), set({ weight: 80, exerciseName: "Supino inclinado" }), set({ weight: 70 })],
      7,
      HOJE,
    );

    expect(de(r, "PEITO").topWeight).toBe(80);
    expect(de(r, "PEITO").topExercise).toBe("Supino inclinado");
  });

  it("volume em kg é carga × repetições, inteiro também no secundário", () => {
    const r = summarizeMuscleLoad([set({ weight: 60, reps: 10, secondaryMuscles: ["TRICEPS"] })], 7, HOJE);
    expect(de(r, "PEITO").volume).toBe(600);
    // Meia série, mas o peso levantado foi o mesmo — o tríceps não levantou "meio quilo".
    expect(de(r, "TRICEPS").volume).toBe(600);
    expect(de(r, "TRICEPS").sets).toBe(0.5);
  });

  it("exercício de peso corporal tem volume zero e ainda assim conta série", () => {
    const r = summarizeMuscleLoad([set({ primaryMuscle: "ABDOMEN", weight: 0, reps: 20 })], 7, HOJE);
    expect(de(r, "ABDOMEN").volume).toBe(0);
    expect(de(r, "ABDOMEN").sets).toBe(1);
    expect(de(r, "ABDOMEN").intensity).toBe("POUCO");
  });

  it("lista vazia devolve os doze zerados, sem quebrar", () => {
    const r = summarizeMuscleLoad([], 7, HOJE);
    expect(r).toHaveLength(12);
    expect(r.every((m) => m.intensity === "NENHUM" && m.sets === 0 && m.daysSince === null)).toBe(true);
  });

  it("a janela é calendário, não instante — não escorrega um dia por causa do UTC", () => {
    // Com `new Date(iso)`, 2026-08-01 é 31/07 no Brasil e a janela inteira andaria um dia.
    const r = summarizeMuscleLoad([set({ date: "2026-08-01" })], 20, "2026-08-20");
    expect(de(r, "PEITO").sets).toBe(1);
    expect(de(r, "PEITO").daysSince).toBe(19);
  });
});
