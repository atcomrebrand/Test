import { matchesExercise, normalize, rankExercises } from "./exercise-search";

const supino = { id: "1", name: "Supino reto com halteres", primaryMuscle: "PEITO", secondaryMuscles: ["TRICEPS"], equipment: "HALTER" };
const rosca = { id: "2", name: "Rosca direta com barra", primaryMuscle: "BICEPS", secondaryMuscles: ["ANTEBRACO"], equipment: "BARRA" };
const triceps = { id: "3", name: "Tríceps pulley com corda", primaryMuscle: "TRICEPS", secondaryMuscles: [], equipment: "CABO" };

describe("busca de exercícios", () => {
  it("acha sem acento, que é como se digita na academia", () => {
    expect(matchesExercise(triceps, { query: "trice" })).toBe(true);
    expect(normalize("Tríceps")).toBe("triceps");
  });

  it("cada palavra pode estar num campo diferente", () => {
    // A frase "supino halter" não existe literalmente em campo nenhum.
    expect(matchesExercise(supino, { query: "supino halter" })).toBe(true);
    expect(matchesExercise(supino, { query: "supino barra" })).toBe(false);
  });

  it("filtra por músculo, incluindo o secundário", () => {
    expect(matchesExercise(supino, { muscle: "TRICEPS" })).toBe(true);
    expect(matchesExercise(rosca, { muscle: "PEITO" })).toBe(false);
  });

  it("filtra por equipamento e por favoritos", () => {
    expect(matchesExercise(rosca, { equipment: "BARRA" })).toBe(true);
    expect(matchesExercise(rosca, { onlyFavorites: true, favoriteIds: new Set(["1"]) })).toBe(false);
    expect(matchesExercise(supino, { onlyFavorites: true, favoriteIds: new Set(["1"]) })).toBe(true);
  });

  it("busca vazia devolve tudo, em vez de nada", () => {
    expect(matchesExercise(supino, { query: "   " })).toBe(true);
  });

  it("quem começa com o termo vem primeiro", () => {
    const ordenado = rankExercises([triceps, supino, rosca], "rosca");
    expect(ordenado[0].name).toBe("Rosca direta com barra");
  });

  it("sem termo, o mais usado vem primeiro", () => {
    const uso = new Map([["3", 12], ["1", 40]]);
    expect(rankExercises([triceps, supino, rosca], "", uso)[0].id).toBe("1");
  });
});
