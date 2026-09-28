import { detectRecords, headlineRecords, PreviousBest } from "./personal-records";

const s = (weight: number, reps: number, setNumber = 1, exerciseId = "supino") => ({
  exerciseId, setNumber, weight, reps, completed: true,
});

const marca = (over: Partial<PreviousBest> = {}): PreviousBest => ({
  maxWeight: 80, repsAtMaxWeight: 8, maxExerciseVolume: 2560, maxOneRm: 101.33, ...over,
});

describe("detectRecords", () => {
  it("detecta carga máxima nova e diz de quanto foi", () => {
    const rs = detectRecords([s(82.5, 6)], new Map([["supino", marca()]]));
    const peso = rs.find((r) => r.kind === "PESO_MAXIMO")!;
    expect(peso.improvement).toBe(2.5);
    expect(peso.weight).toBe(82.5);
  });

  it("detecta mais repetições no mesmo peso — a evolução de quem ainda não subiu a carga", () => {
    const rs = detectRecords([s(80, 10)], new Map([["supino", marca({ maxExerciseVolume: 5000, maxOneRm: 200 })]]));
    const reps = rs.find((r) => r.kind === "REPS_NO_PESO")!;
    expect(reps.reps).toBe(10);
    expect(reps.improvement).toBe(2);
  });

  it("PRIMEIRA VEZ não é recorde", () => {
    // Um treino com oito exercícios novos viraria 32 troféus e a palavra perderia o sentido.
    expect(detectRecords([s(100, 10)], new Map())).toEqual([]);
  });

  it("repetir exatamente a marca anterior não é recorde", () => {
    expect(detectRecords([s(80, 8)], new Map([["supino", marca()]]))).toEqual([]);
  });

  it("ignora série não concluída", () => {
    const rs = detectRecords(
      [{ ...s(200, 10), completed: false }],
      new Map([["supino", marca()]]),
    );
    expect(rs).toEqual([]);
  });

  it("detecta 1RM mesmo quando a carga não foi a maior de sempre", () => {
    // 75×12 estima 105 kg, acima do 1RM anterior de 101,33 — sem bater os 80 kg de carga.
    const rs = detectRecords([s(75, 12)], new Map([["supino", marca({ maxExerciseVolume: 99999 })]]));
    expect(rs.map((r) => r.kind)).toEqual(["UM_RM"]);
    expect(rs[0].estimatedOneRm).toBe(105);
  });

  it("detecta volume do exercício na sessão, somando as séries", () => {
    const rs = detectRecords(
      [s(80, 8, 1), s(80, 8, 2), s(80, 8, 3), s(80, 8, 4), s(80, 8, 5)],
      new Map([["supino", marca({ maxOneRm: 200 })]]),
    );
    expect(rs.find((r) => r.kind === "VOLUME_EXERCICIO")!.improvement).toBe(3200 - 2560);
  });

  it("subir a carga costuma bater vários tipos de uma vez", () => {
    const rs = detectRecords([s(90, 8), s(90, 8, 2), s(90, 8, 3), s(90, 8, 4)], new Map([["supino", marca()]]));
    expect(new Set(rs.map((r) => r.kind))).toEqual(new Set(["PESO_MAXIMO", "VOLUME_EXERCICIO", "UM_RM"]));
    // Mas na tela de conclusão aparece um só, o mais significativo.
    const destaque = headlineRecords(rs);
    expect(destaque).toHaveLength(1);
    expect(destaque[0].kind).toBe("PESO_MAXIMO");
  });

  it("separa recordes de exercícios diferentes", () => {
    const rs = detectRecords(
      [s(85, 8, 1, "supino"), s(150, 5, 1, "agachamento")],
      new Map([
        ["supino", marca()],
        ["agachamento", marca({ maxWeight: 140, repsAtMaxWeight: 5, maxExerciseVolume: 3500, maxOneRm: 163 })],
      ]),
    );
    expect(headlineRecords(rs).map((r) => r.exerciseId).sort()).toEqual(["agachamento", "supino"]);
  });
});
