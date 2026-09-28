import { estimateOneRm, OneRmFormula } from "./one-rm";

/** Uma série como o resto do módulo a enxerga. Só o que a conta precisa. */
export interface SetLike {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  restSeconds?: number | null;
  restActualSeconds?: number | null;
  restWasSkipped?: boolean;
}

export interface SessionMetrics {
  /** Σ carga × repetições das séries CONCLUÍDAS. Série marcada como não concluída não levantou
   *  peso nenhum — contá-la infla o volume com o que não aconteceu. */
  totalVolume: number;
  completedSets: number;
  plannedSets: number;
  exercisesPerformed: number;
  /** Segundos de relógio entre início e fim da sessão. */
  durationSeconds: number | null;
  /** Soma do que foi realmente descansado. Só das séries que chegaram a descansar. */
  totalRestSeconds: number;
  /** Média por série que descansou — não por série total: a última de cada exercício às vezes não
   *  tem descanso, e diluir por ela puxaria a média pra baixo sem motivo. */
  averageRestSeconds: number | null;
  skippedRests: number;
  /** Tempo em que a pessoa esteve efetivamente executando, não descansando. Serve pro resumo:
   *  "55 min, sendo 18 de descanso" diz mais que 55 min sozinho. */
  workingSeconds: number | null;
}

export function summarizeSession(
  sets: SetLike[],
  startedAt: Date,
  finishedAt: Date | null,
  plannedSets = 0,
): SessionMetrics {
  const concluidas = sets.filter((s) => s.completed);
  const totalVolume = round2(concluidas.reduce((acc, s) => acc + s.weight * s.reps, 0));

  const comDescanso = sets.filter((s) => typeof s.restActualSeconds === "number" && s.restActualSeconds! >= 0);
  const totalRest = comDescanso.reduce((acc, s) => acc + (s.restActualSeconds ?? 0), 0);

  const duration = finishedAt ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)) : null;

  return {
    totalVolume,
    completedSets: concluidas.length,
    plannedSets: Math.max(plannedSets, sets.length),
    exercisesPerformed: new Set(concluidas.map((s) => s.exerciseId)).size,
    durationSeconds: duration,
    totalRestSeconds: totalRest,
    averageRestSeconds: comDescanso.length > 0 ? Math.round(totalRest / comDescanso.length) : null,
    skippedRests: sets.filter((s) => s.restWasSkipped).length,
    workingSeconds: duration === null ? null : Math.max(0, duration - totalRest),
  };
}

/** Volume de um exercício dentro da sessão — a base do recorde de volume. */
export function volumeByExercise(sets: SetLike[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const s of sets) {
    if (!s.completed) continue;
    mapa.set(s.exerciseId, round2((mapa.get(s.exerciseId) ?? 0) + s.weight * s.reps));
  }
  return mapa;
}

/**
 * Duração estimada de uma ficha, pro card "aproximadamente 55 min".
 *
 * A conta é séries × (execução + descanso). A execução é estimada em segundos por repetição, porque
 * é o que varia de verdade entre uma série de 5 e uma de 15 — usar um valor fixo por série faria um
 * treino de força parecer tão longo quanto um de resistência.
 */
const SECONDS_PER_REP = 3.5;
/** A última série de cada exercício não é seguida de descanso dele; some do total. */
export function estimateWorkoutSeconds(
  exercises: { sets: number; targetRepsMin: number; targetRepsMax: number; restSeconds: number }[],
  restBetweenExercisesSeconds: number | null = null,
): number {
  let total = 0;
  for (const e of exercises) {
    const reps = (e.targetRepsMin + e.targetRepsMax) / 2;
    const execucao = reps * SECONDS_PER_REP;
    total += e.sets * execucao + Math.max(0, e.sets - 1) * e.restSeconds;
    total += restBetweenExercisesSeconds ?? e.restSeconds;
  }
  // O descanso somado depois do ÚLTIMO exercício não existe: o treino acabou.
  const ultimo = exercises[exercises.length - 1];
  if (ultimo) total -= restBetweenExercisesSeconds ?? ultimo.restSeconds;
  return Math.max(0, Math.round(total));
}

/** O melhor 1RM estimado de um conjunto de séries. */
export function bestOneRm(sets: SetLike[], formula: OneRmFormula): number | null {
  let melhor: number | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const est = estimateOneRm(s.weight, s.reps, formula);
    if (est !== null && (melhor === null || est > melhor)) melhor = est;
  }
  return melhor;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
