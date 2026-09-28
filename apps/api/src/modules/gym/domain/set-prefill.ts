/**
 * Registro inteligente (§20): a série já vem preenchida com o que a pessoa fez da última vez.
 *
 * Na academia, entre uma série e outra, digitar "80" de novo é o tipo de atrito que faz alguém
 * parar de registrar treino. O que estava lá na última sessão é quase sempre o que vai ser feito
 * agora — e quando não é, mudar um número é mais rápido que digitar dois.
 */
export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight: number | null;
  restSeconds: number;
}

export interface LastSet {
  setNumber: number;
  weight: number;
  reps: number;
}

export interface PrefilledSet {
  setNumber: number;
  weight: number;
  reps: number;
  restSeconds: number;
  /** Veio do histórico ou é só a meta da ficha. A tela usa isso pra dizer "última vez: 80 kg × 8". */
  fromHistory: boolean;
}

export function prefillSets(plan: PlannedExercise, lastSets: LastSet[] = []): PrefilledSet[] {
  const porNumero = new Map(lastSets.map((s) => [s.setNumber, s]));
  // Quando a ficha pede mais séries do que foram feitas da última vez, as sobrando repetem a última
  // conhecida — é o que a pessoa faria: continuar no mesmo peso.
  const ultima = lastSets.length > 0 ? lastSets.reduce((a, b) => (b.setNumber > a.setNumber ? b : a)) : null;

  return Array.from({ length: Math.max(1, plan.sets) }, (_, i) => {
    const numero = i + 1;
    const anterior = porNumero.get(numero) ?? ultima;
    return {
      setNumber: numero,
      weight: anterior?.weight ?? plan.targetWeight ?? 0,
      // Sem histórico, o piso da faixa: prometer o topo faz a série nascer marcada como fracasso
      // quando a pessoa faz o que era esperado.
      reps: anterior?.reps ?? plan.targetRepsMin,
      restSeconds: plan.restSeconds,
      fromHistory: anterior !== null && anterior !== undefined,
    };
  });
}

/** "80 kg × 8" da última vez, pra mostrar ao lado do campo. Nulo quando é a estreia. */
export function lastPerformanceLabel(lastSets: LastSet[], unit = "kg"): string | null {
  if (lastSets.length === 0) return null;
  const melhor = lastSets.reduce((a, b) => (b.weight > a.weight ? b : a));
  return `${formatNumber(melhor.weight)} ${unit} × ${melhor.reps}`;
}

function formatNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}
