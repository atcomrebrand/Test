import { estimateOneRm, OneRmFormula } from "./one-rm";
import { SetLike, volumeByExercise } from "./session-metrics";

export type RecordKind = "PESO_MAXIMO" | "REPS_NO_PESO" | "VOLUME_EXERCICIO" | "UM_RM";

/** O melhor de sempre daquele exercício, ANTES desta sessão. Tudo nulo = nunca foi feito. */
export interface PreviousBest {
  maxWeight: number | null;
  /** Repetições feitas na maior carga — o que "mais repetições com o mesmo peso" precisa superar. */
  repsAtMaxWeight: number | null;
  maxExerciseVolume: number | null;
  maxOneRm: number | null;
}

export interface DetectedRecord {
  exerciseId: string;
  kind: RecordKind;
  weight: number;
  reps: number;
  estimatedOneRm: number | null;
  /** De quanto foi a superação, na unidade do próprio tipo (kg, repetições, kg de volume). */
  improvement: number;
}

/**
 * Detecta os recordes de uma sessão recém-concluída.
 *
 * **Primeira vez num exercício não é recorde.** Recorde é superar algo, e um treino com oito
 * exercícios novos dispararia trinta e dois troféus na tela de conclusão — a palavra perderia o
 * sentido logo no primeiro uso do app. A primeira execução apenas estabelece a marca a ser batida.
 *
 * Séries não concluídas ficam de fora: não levantaram peso nenhum.
 */
export function detectRecords(
  sets: SetLike[],
  previous: Map<string, PreviousBest>,
  formula: OneRmFormula = "EPLEY",
): DetectedRecord[] {
  const concluidas = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  const volumes = volumeByExercise(concluidas);
  const encontrados: DetectedRecord[] = [];

  for (const exerciseId of new Set(concluidas.map((s) => s.exerciseId))) {
    const doExercicio = concluidas.filter((s) => s.exerciseId === exerciseId);
    const anterior = previous.get(exerciseId);
    // Sem marca anterior não há o que superar.
    if (!anterior) continue;

    const maisPesada = doExercicio.reduce((a, b) => (b.weight > a.weight ? b : a));

    if (anterior.maxWeight !== null && maisPesada.weight > anterior.maxWeight) {
      encontrados.push({
        exerciseId,
        kind: "PESO_MAXIMO",
        weight: maisPesada.weight,
        reps: maisPesada.reps,
        estimatedOneRm: estimateOneRm(maisPesada.weight, maisPesada.reps, formula),
        improvement: round2(maisPesada.weight - anterior.maxWeight),
      });
    } else if (anterior.maxWeight !== null && anterior.repsAtMaxWeight !== null) {
      // Mesmo peso de sempre, mais repetições — a evolução de quem ainda não subiu a carga.
      const noMesmoPeso = doExercicio.filter((s) => s.weight === anterior.maxWeight);
      const melhor = noMesmoPeso.reduce<SetLike | null>((a, b) => (a === null || b.reps > a.reps ? b : a), null);
      if (melhor && melhor.reps > anterior.repsAtMaxWeight) {
        encontrados.push({
          exerciseId,
          kind: "REPS_NO_PESO",
          weight: melhor.weight,
          reps: melhor.reps,
          estimatedOneRm: estimateOneRm(melhor.weight, melhor.reps, formula),
          improvement: melhor.reps - anterior.repsAtMaxWeight,
        });
      }
    }

    const volume = volumes.get(exerciseId) ?? 0;
    if (anterior.maxExerciseVolume !== null && volume > anterior.maxExerciseVolume) {
      encontrados.push({
        exerciseId,
        kind: "VOLUME_EXERCICIO",
        weight: maisPesada.weight,
        reps: maisPesada.reps,
        estimatedOneRm: null,
        improvement: round2(volume - anterior.maxExerciseVolume),
      });
    }

    let melhorRm: { est: number; set: SetLike } | null = null;
    for (const s of doExercicio) {
      const est = estimateOneRm(s.weight, s.reps, formula);
      if (est !== null && (melhorRm === null || est > melhorRm.est)) melhorRm = { est, set: s };
    }
    if (melhorRm && anterior.maxOneRm !== null && melhorRm.est > anterior.maxOneRm) {
      encontrados.push({
        exerciseId,
        kind: "UM_RM",
        weight: melhorRm.set.weight,
        reps: melhorRm.set.reps,
        estimatedOneRm: melhorRm.est,
        improvement: round2(melhorRm.est - anterior.maxOneRm),
      });
    }
  }

  return encontrados;
}

/** Ordem de importância pra quando um exercício bate mais de um tipo ao mesmo tempo. */
const PRIORIDADE: RecordKind[] = ["PESO_MAXIMO", "UM_RM", "REPS_NO_PESO", "VOLUME_EXERCICIO"];

/**
 * Um recorde por exercício, pra tela de conclusão.
 *
 * Subir a carga costuma bater peso, 1RM e volume de uma vez — três troféus para uma conquista só
 * fariam a lista parecer maior do que o que realmente aconteceu. Todos continuam gravados; o que
 * muda é o que aparece em destaque.
 */
export function headlineRecords(records: DetectedRecord[]): DetectedRecord[] {
  const porExercicio = new Map<string, DetectedRecord>();
  for (const r of records) {
    const atual = porExercicio.get(r.exerciseId);
    if (!atual || PRIORIDADE.indexOf(r.kind) < PRIORIDADE.indexOf(atual.kind)) porExercicio.set(r.exerciseId, r);
  }
  return [...porExercicio.values()];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
