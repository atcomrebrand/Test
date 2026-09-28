export type GymMuscleKey =
  | "PEITO"
  | "COSTAS"
  | "BICEPS"
  | "TRICEPS"
  | "OMBROS"
  | "QUADRICEPS"
  | "POSTERIORES"
  | "GLUTEOS"
  | "PANTURRILHAS"
  | "ABDOMEN"
  | "TRAPEZIO"
  | "ANTEBRACO";

export const MUSCLE_KEYS: GymMuscleKey[] = [
  "PEITO",
  "COSTAS",
  "BICEPS",
  "TRICEPS",
  "OMBROS",
  "QUADRICEPS",
  "POSTERIORES",
  "GLUTEOS",
  "PANTURRILHAS",
  "ABDOMEN",
  "TRAPEZIO",
  "ANTEBRACO",
];

export interface MuscleSetInput {
  /** ISO yyyy-mm-dd do dia do treino. */
  date: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: GymMuscleKey;
  secondaryMuscles: GymMuscleKey[];
  weight: number;
  reps: number;
}

export type MuscleIntensity = "NENHUM" | "POUCO" | "MEDIO" | "MUITO";

export interface MuscleLoad {
  muscle: GymMuscleKey;
  /**
   * Séries efetivas: 1 quando o exercício é do músculo, 0,5 quando ele é secundário.
   *
   * É esta a medida que pinta o boneco, e não o volume em kg — ver `summarizeMuscleLoad`.
   */
  sets: number;
  /** Volume em kg (carga × repetições), somando série primária e secundária inteiras. Serve pro
   *  detalhe do músculo, onde a comparação é dele com ele mesmo ao longo do tempo. */
  volume: number;
  /** Quantos treinos distintos tocaram nesse músculo na janela. */
  sessions: number;
  /** Última vez que ele foi treinado, olhando o histórico INTEIRO e não só a janela — senão um
   *  músculo parado há três meses e um treinado ontem ficariam os dois como "nunca". */
  lastTrainedAt: string | null;
  /** Dias desde o último treino. `null` quando nunca foi treinado. */
  daysSince: number | null;
  intensity: MuscleIntensity;
  /** Maior carga levantada nesse músculo dentro da janela, e em qual exercício. */
  topWeight: number;
  topExercise: string | null;
}

/**
 * As faixas de séries semanais.
 *
 * Vêm da referência de volume que a literatura de hipertrofia usa (perto de 10 séries semanais por
 * grupo como piso útil, e 20+ como volume alto). Não são lei, mas são uma régua **externa** — sem
 * ela, "muito" viraria "mais que os seus outros músculos", e aí quem treina pouco veria vermelho
 * por treinar menos ainda o resto.
 */
const FAIXA_MEDIO = 10;
const FAIXA_MUITO = 20;

/** As faixas são semanais; numa janela de 30 dias, 10 séries não é volume médio. */
function limiares(days: number): { medio: number; muito: number } {
  const semanas = Math.max(days / 7, 1);
  return { medio: FAIXA_MEDIO * semanas, muito: FAIXA_MUITO * semanas };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function classify(sets: number, days: number): MuscleIntensity {
  if (sets <= 0) return "NENHUM";
  const { medio, muito } = limiares(days);
  if (sets >= muito) return "MUITO";
  if (sets >= medio) return "MEDIO";
  return "POUCO";
}

/**
 * Quanto cada músculo foi treinado numa janela — o dado que pinta o boneco.
 *
 * **A cor sai de SÉRIES, nunca de quilos.** É a decisão que faz o mapa dizer a verdade. Volume em kg
 * não é comparável entre músculos: um leg press soma 10.000 kg numa sessão e uma elevação lateral
 * soma 800 kg no mesmo esforço, então a perna ficaria permanentemente vermelha e o ombro
 * permanentemente verde independentemente de como a pessoa treina — o boneco desenharia a anatomia
 * dos exercícios, não o treino. Série é a unidade que a literatura usa justamente por ser comparável
 * entre exercícios e grupos. Os quilos continuam na resposta, e é lá que eles significam algo: no
 * detalhe de UM músculo ao longo do tempo, comparado com ele mesmo.
 *
 * **Músculo secundário conta meia série.** Supino é peito, mas também é tríceps e ombro. Contando
 * só o primário, o mapa afirmaria que a pessoa nunca treina tríceps quando ela treina em todo
 * empurrar; contando inteiro, uma série de supino valeria o mesmo pro peito e pro tríceps, o que
 * também não é verdade.
 *
 * `today` entra como parâmetro em vez de vir do relógio: função pura é testável, e o "hoje" do
 * servidor (UTC) não é o mesmo do Brasil.
 */
export function summarizeMuscleLoad(sets: MuscleSetInput[], days: number, today: string): MuscleLoad[] {
  const inicio = shiftDate(today, -(days - 1));

  const acc = new Map<
    GymMuscleKey,
    { sets: number; volume: number; sessions: Set<string>; topWeight: number; topExercise: string | null; last: string | null }
  >();
  for (const m of MUSCLE_KEYS) {
    acc.set(m, { sets: 0, volume: 0, sessions: new Set(), topWeight: 0, topExercise: null, last: null });
  }

  for (const s of sets) {
    const volume = s.weight * s.reps;
    // Primário conta série inteira; secundário, meia.
    const alvos: [GymMuscleKey, number][] = [
      [s.primaryMuscle, 1],
      ...s.secondaryMuscles.filter((m) => m !== s.primaryMuscle).map((m) => [m, 0.5] as [GymMuscleKey, number]),
    ];

    for (const [muscle, peso] of alvos) {
      const atual = acc.get(muscle);
      if (!atual) continue;

      // O último treino olha o histórico inteiro: é o que responde "faz quanto tempo que não treino
      // isso", e essa pergunta não pode ser limitada pela janela escolhida na tela.
      if (atual.last === null || s.date > atual.last) atual.last = s.date;

      if (s.date < inicio || s.date > today) continue;

      atual.sets += peso;
      atual.volume += volume;
      atual.sessions.add(s.sessionId);
      if (s.weight > atual.topWeight) {
        atual.topWeight = s.weight;
        atual.topExercise = s.exerciseName;
      }
    }
  }

  return MUSCLE_KEYS.map((muscle) => {
    const a = acc.get(muscle)!;
    return {
      muscle,
      sets: round2(a.sets),
      volume: round2(a.volume),
      sessions: a.sessions.size,
      lastTrainedAt: a.last,
      daysSince: a.last === null ? null : daysBetween(a.last, today),
      intensity: classify(a.sets, days),
      topWeight: a.topWeight,
      topExercise: a.topExercise,
    };
  });
}

/**
 * Datas em calendário, nunca em instantes.
 *
 * `new Date("2026-08-01")` é meia-noite UTC, que no Brasil ainda é 31 de julho — a mesma armadilha
 * do melhor dia de compra do Mercado. Aqui ela deslocaria a janela inteira em um dia.
 */
function toUtcNoon(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

function shiftDate(iso: string, days: number): string {
  const d = toUtcNoon(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtcNoon(to).getTime() - toUtcNoon(from).getTime()) / 86_400_000);
}
