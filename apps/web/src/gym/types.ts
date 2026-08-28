export type GymMuscle =
  | "PEITO" | "COSTAS" | "BICEPS" | "TRICEPS" | "OMBROS" | "QUADRICEPS"
  | "POSTERIORES" | "GLUTEOS" | "PANTURRILHAS" | "ABDOMEN" | "TRAPEZIO" | "ANTEBRACO";

export type GymEquipment =
  | "BARRA" | "HALTER" | "MAQUINA" | "CABO" | "PESO_CORPORAL" | "SMITH" | "KETTLEBELL" | "ELASTICO" | "OUTRO";

export type GymObjective = "HIPERTROFIA" | "FORCA" | "EMAGRECIMENTO" | "CONDICIONAMENTO" | "MANUTENCAO";
export type GymLevel = "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
export type GymWeightUnit = "KG" | "LB";
export type GymOneRmFormula = "EPLEY" | "BRZYCKI" | "LOMBARDI";
export type GymPhotoPose = "FRENTE" | "COSTAS" | "LATERAL";
export type GymRecordKind = "PESO_MAXIMO" | "REPS_NO_PESO" | "VOLUME_EXERCICIO" | "UM_RM";
export type GymTargetKind = "CARGA" | "FREQUENCIA_SEMANAL" | "PESO_CORPORAL";
export type ProgressRange = "WEEK" | "MONTH" | "M3" | "M6" | "YEAR";

export interface GymProfile {
  userId: string;
  objective: GymObjective;
  level: GymLevel;
  heightCm: number | null;
  birthDate: string | null;
  weeklyTarget: number;
  sessionMinutes: number;
  defaultRestSeconds: number;
  weightUnit: GymWeightUnit;
  oneRmFormula: GymOneRmFormula;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /** Concluir uma série já deixa a próxima em execução. Ligado por padrão. */
  autoAdvanceSets: boolean;
  onboardedAt: string | null;
}

export interface GymExercise {
  id: string;
  name: string;
  primaryMuscle: GymMuscle;
  secondaryMuscles: GymMuscle[];
  equipment: GymEquipment;
  description: string | null;
  instructions: string[];
  tips: string[];
  commonMistakes: string[];
  image: string | null;
  favorite: boolean;
  timesPerformed: number;
  custom: boolean;
}

export interface GymExerciseDetail extends GymExercise {
  history: { sessionId: string; date: string; sets: number; topWeight: number; topReps: number; volume: number }[];
  loadEvolution: { date: string; weight: number; reps: number; oneRm: number | null; volume: number }[];
}

export interface GymWorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  sets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight: number | null;
  restSeconds: number;
  notes: string | null;
  exercise: GymExercise;
}

export interface GymWorkout {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  order: number;
  restBetweenExercisesSeconds: number | null;
  muscles: GymMuscle[];
  exerciseCount: number;
  totalSets: number;
  estimatedSeconds: number;
  exercises: GymWorkoutExercise[];
  lastPerformedAt?: string | null;
  timesPerformed?: number;
  averageDurationSeconds?: number | null;
}

export interface PrefilledSet {
  setNumber: number;
  weight: number;
  reps: number;
  restSeconds: number;
  fromHistory: boolean;
}

export interface PrefillExercise {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  primaryMuscle: GymMuscle;
  equipment: GymEquipment;
  image: string | null;
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
  notes: string | null;
  lastSets: { setNumber: number; weight: number; reps: number }[];
  sets: PrefilledSet[];
}

export interface GymPrefill {
  workout: GymWorkout;
  exercises: PrefillExercise[];
}

export interface SessionMetrics {
  totalVolume: number;
  completedSets: number;
  plannedSets: number;
  exercisesPerformed: number;
  durationSeconds: number | null;
  totalRestSeconds: number;
  averageRestSeconds: number | null;
  skippedRests: number;
  workingSeconds: number | null;
}

export interface GymRecord {
  id?: string;
  kind: GymRecordKind;
  exerciseId: string;
  exerciseName?: string;
  primaryMuscle?: GymMuscle;
  weight: number;
  reps: number;
  estimatedOneRm: number | null;
  improvement: number | null;
  achievedAt?: string;
  sessionId?: string | null;
}

export interface GymSessionSummary {
  id: string;
  name: string;
  workoutId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  totalVolume: number;
  setCount: number;
  exerciseCount: number;
}

export interface GymSessionDetail {
  id: string;
  clientId: string;
  name: string;
  workoutId: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  metrics: SessionMetrics;
  exercises: {
    exercise: { id: string; name: string; primaryMuscle: GymMuscle; equipment: GymEquipment };
    order: number;
    sets: {
      id: string; setNumber: number; weight: number; reps: number; completed: boolean; notes: string | null;
      restSeconds: number | null; restActualSeconds: number | null; restWasPaused: boolean; restWasSkipped: boolean;
    }[];
  }[];
  records: GymRecord[];
  newRecords?: GymRecord[];
}

export interface GymHome {
  profile: GymProfile;
  onboarded: boolean;
  nextWorkout: GymWorkout | null;
  week: { done: number; target: number; minutes: number; volume: number };
  weekDays: { date: string; weekday: number; sessions: number; volume: number }[];
  volumeSeries: { date: string; value: number; sessions: number }[];
  lastSession: { id: string; name: string; startedAt: string; durationSeconds: number | null; totalVolume: number; exerciseCount: number } | null;
  recentRecords: GymRecord[];
  workoutCount: number;
}

export interface GymCalendar {
  year: number;
  month: number;
  days: { date: string; sessions: number; volume: number; minutes: number; names: string[] }[];
}

export interface GymProgress {
  range: ProgressRange;
  volumeSeries: { date: string; value: number }[];
  frequencySeries: { date: string; value: number }[];
  durationSeries: { date: string; value: number }[];
  bodyWeightSeries: { date: string; value: number }[];
  totals: {
    sessions: number; volume: number; minutes: number; averageMinutes: number | null;
    averageRestSeconds: number | null; totalRestMinutes: number; records: number; consistencyPercent: number | null;
  };
}

export interface GymMeasurement {
  id: string; date: string;
  weightKg: number | null; chest: number | null; waist: number | null; abdomen: number | null; hip: number | null;
  armRight: number | null; armLeft: number | null; thighRight: number | null; thighLeft: number | null;
  calfRight: number | null; calfLeft: number | null;
  custom: Record<string, number> | null; notes: string | null;
}

export interface GymPhoto {
  id: string; date: string; pose: GymPhotoPose; image: string; notes: string | null;
}

export interface GymTarget {
  id: string; kind: GymTargetKind; label: string;
  exerciseId: string | null; exerciseName: string | null;
  targetValue: number; startValue: number | null; currentValue: number | null;
  progressPercent: number; deadline: string | null; achievedAt: string | null;
}
