import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  adjustRest,
  finishRest,
  IDLE_REST,
  pauseRest,
  RestRecord,
  restRecordOf,
  RestTimerState,
  resumeRest,
  settleRest,
  skipRest,
  startRest,
} from "../domain/rest-timer";
import { GymMuscle, GymEquipment, GymPrefill, GymRecord } from "../types";

export interface ActiveSet {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  /** Quando o ▶ foi tocado. Enquanto existe e não está concluída, a série está EM EXECUÇÃO. */
  startedAt?: number;
  notes?: string;
  /** Preenchido quando o descanso daquela série termina (§37). */
  rest: RestRecord | null;
  completedAt?: string;
}

export interface ActiveExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: GymMuscle;
  equipment: GymEquipment;
  image: string | null;
  order: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
  notes: string | null;
  lastLabel: string | null;
  /** O que foi feito da última vez, exercício a exercício — a tabela "Histórico de séries". */
  lastSets: { setNumber: number; weight: number; reps: number }[];
  /** Concluir uma série já deixa a próxima em execução, sem passar pelo ▶. */
  autoAdvance: boolean;
  sets: ActiveSet[];
}

export interface ActiveSession {
  clientId: string;
  workoutId: string | null;
  name: string;
  startedAt: number;
  finishedAt: number | null;
  exercises: ActiveExercise[];
  /** Qual exercício está aberto. `-1` = nenhum, que é a lista fechada do começo do treino. */
  currentIndex: number;
  notes: string;
  rest: RestTimerState;
  /** Qual série está descansando, pra gravar o registro no lugar certo quando terminar. */
  restTarget: { exerciseIndex: number; setNumber: number } | null;
  /** Já foi aceita pelo servidor? Enquanto for false, a sessão continua sendo tentada. */
  synced: boolean;
  /** O aviso sonoro/tátil do fim do descanso já foi disparado? Evita repetir a cada quadro. */
  alerted: boolean;
}

interface SessionStore {
  session: ActiveSession | null;
  /** Sessões finalizadas que ainda não subiram — a fila do offline. */
  pending: ActiveSession[];
  /**
   * A última sessão finalizada, guardada mesmo depois de subir.
   *
   * A tela de conclusão precisa dela: se ela lesse só a fila, o resumo sumiria da tela no instante
   * em que a subida desse certo — justamente quando dá tudo certo.
   */
  lastFinished: ActiveSession | null;
  /** Os recordes que o servidor detectou nessa última sessão. */
  lastRecords: GymRecord[];

  start: (prefill: GymPrefill, now?: number) => void;
  discard: () => void;

  setCurrentIndex: (index: number) => void;
  /** Abre/fecha um exercício da lista. Abrir um fecha o outro: dois abertos viram rolagem infinita. */
  toggleExercise: (index: number) => void;
  setAutoAdvance: (exerciseIndex: number, value: boolean) => void;
  /** Marca a série como em execução (o ▶ do cartão). */
  startSet: (exerciseIndex: number, setNumber: number, now?: number) => void;
  updateSet: (exerciseIndex: number, setNumber: number, patch: Partial<ActiveSet>) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number) => void;
  /** Conclui a série e dispara o descanso na mesma ação — é o § 54 inteiro num toque. */
  completeSet: (exerciseIndex: number, setNumber: number, now?: number) => void;
  uncompleteSet: (exerciseIndex: number, setNumber: number) => void;
  setNotes: (notes: string) => void;

  beginRest: (seconds: number, target?: { exerciseIndex: number; setNumber: number } | null, now?: number) => void;
  tickRest: (now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  adjust: (deltaSeconds: number, now?: number) => void;
  skip: (now?: number) => void;
  stopRest: (now?: number) => void;
  markAlerted: () => void;

  finish: (now?: number) => ActiveSession | null;
  markSynced: (clientId: string, records?: GymRecord[]) => void;
}

/** Id do aparelho, não do servidor: é ele que torna a subida idempotente. */
function newClientId(): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `gym-${rnd}`;
}

/** Aplica o registro do descanso na série a que ele pertence. */
function commitRest(session: ActiveSession, now: number): ActiveSession {
  if (!session.restTarget) return session;
  const registro = restRecordOf(session.rest, now);
  if (!registro) return session;

  const exercises = session.exercises.map((ex, i) => {
    if (i !== session.restTarget!.exerciseIndex) return ex;
    return {
      ...ex,
      sets: ex.sets.map((s) => (s.setNumber === session.restTarget!.setNumber ? { ...s, rest: registro } : s)),
    };
  });
  return { ...session, exercises };
}

export const useGymSessionStore = create<SessionStore>()(
  persist(
    (set, get) => {
      /** Toda mutação passa por aqui, e só existe sessão pra mexer se houver uma ativa. */
      const patch = (fn: (s: ActiveSession) => ActiveSession) => {
        const atual = get().session;
        if (!atual) return;
        set({ session: fn(atual) });
      };

      return {
        session: null,
        pending: [],
        lastFinished: null,
        lastRecords: [],

        start: (prefill, now = Date.now()) => {
          set({
            session: {
              clientId: newClientId(),
              workoutId: prefill.workout.id,
              name: prefill.workout.name,
              startedAt: now,
              finishedAt: null,
              currentIndex: -1,
              notes: "",
              rest: IDLE_REST,
              restTarget: null,
              synced: false,
              alerted: false,
              exercises: prefill.exercises.map((e) => ({
                lastSets: e.lastSets,
                autoAdvance: false,
                exerciseId: e.exerciseId,
                name: e.name,
                primaryMuscle: e.primaryMuscle,
                equipment: e.equipment,
                image: e.image,
                order: e.order,
                targetRepsMin: e.targetRepsMin,
                targetRepsMax: e.targetRepsMax,
                restSeconds: e.restSeconds,
                notes: e.notes,
                lastLabel:
                  e.lastSets.length > 0
                    ? `${formatKg(Math.max(...e.lastSets.map((s) => s.weight)))} × ${
                        e.lastSets.find((s) => s.weight === Math.max(...e.lastSets.map((x) => x.weight)))!.reps
                      }`
                    : null,
                sets: e.sets.map((s) => ({
                  setNumber: s.setNumber,
                  weight: s.weight,
                  reps: s.reps,
                  completed: false,
                  rest: null,
                })),
              })),
            },
          });
        },

        discard: () => set({ session: null }),

        setCurrentIndex: (index) => patch((s) => ({ ...s, currentIndex: Math.max(-1, Math.min(index, s.exercises.length - 1)) })),

        toggleExercise: (index) => patch((s) => ({ ...s, currentIndex: s.currentIndex === index ? -1 : index })),

        setAutoAdvance: (exerciseIndex, value) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) => (i === exerciseIndex ? { ...ex, autoAdvance: value } : ex)),
          })),

        startSet: (exerciseIndex, setNumber, now = Date.now()) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) =>
              i !== exerciseIndex
                ? ex
                : { ...ex, sets: ex.sets.map((st) => (st.setNumber === setNumber ? { ...st, startedAt: now } : st)) },
            ),
          })),

        updateSet: (exerciseIndex, setNumber, p) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) =>
              i !== exerciseIndex ? ex : { ...ex, sets: ex.sets.map((st) => (st.setNumber === setNumber ? { ...st, ...p } : st)) },
            ),
          })),

        addSet: (exerciseIndex) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) => {
              if (i !== exerciseIndex) return ex;
              const ultima = ex.sets[ex.sets.length - 1];
              return {
                ...ex,
                // A série nova nasce igual à anterior — é o que se faz na prática.
                sets: [...ex.sets, { setNumber: (ultima?.setNumber ?? 0) + 1, weight: ultima?.weight ?? 0, reps: ultima?.reps ?? ex.targetRepsMin, completed: false, rest: null }],
              };
            }),
          })),

        removeSet: (exerciseIndex) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) => (i !== exerciseIndex || ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.slice(0, -1) })),
          })),

        completeSet: (exerciseIndex, setNumber, now = Date.now()) =>
          patch((s) => {
            const exercicio = s.exercises[exerciseIndex];
            if (!exercicio) return s;
            const comSerie = {
              ...s,
              exercises: s.exercises.map((ex, i) =>
                i !== exerciseIndex
                  ? ex
                  : { ...ex, sets: ex.sets.map((st) => (st.setNumber === setNumber ? { ...st, completed: true, completedAt: new Date(now).toISOString() } : st)) },
              ),
            };
            // Concluir a série JÁ começa o descanso: sem isso o §55 vira dois toques, e o segundo é
            // o que as pessoas esquecem no meio do treino.
            //
            // Com "execução automática" ligada, a série seguinte também já entra em execução — quem
            // ligou isso não quer tocar em ▶ de novo ao sair do descanso.
            const comProxima = exercicio.autoAdvance
              ? {
                  ...comSerie,
                  exercises: comSerie.exercises.map((ex, i) =>
                    i !== exerciseIndex
                      ? ex
                      : {
                          ...ex,
                          sets: ex.sets.map((st) =>
                            st.setNumber === setNumber + 1 && !st.completed ? { ...st, startedAt: now } : st,
                          ),
                        },
                  ),
                }
              : comSerie;

            return {
              ...comProxima,
              rest: startRest(exercicio.restSeconds, now),
              restTarget: { exerciseIndex, setNumber },
              alerted: exercicio.restSeconds === 0,
            };
          }),

        uncompleteSet: (exerciseIndex, setNumber) =>
          patch((s) => ({
            ...s,
            exercises: s.exercises.map((ex, i) =>
              i !== exerciseIndex ? ex : { ...ex, sets: ex.sets.map((st) => (st.setNumber === setNumber ? { ...st, completed: false } : st)) },
            ),
          })),

        setNotes: (notes) => patch((s) => ({ ...s, notes })),

        beginRest: (seconds, target = null, now = Date.now()) =>
          patch((s) => ({ ...s, rest: startRest(seconds, now), restTarget: target ?? s.restTarget, alerted: seconds === 0 })),

        /**
         * Chamado a cada quadro e ao voltar do segundo plano.
         *
         * Não conta nada: só pergunta ao estado se o instante de término já passou. Quando passou,
         * o registro do descanso é gravado na série na mesma hora — assim ele existe mesmo que a
         * pessoa feche o app logo depois do apito.
         */
        tickRest: (now = Date.now()) =>
          patch((s) => {
            const depois = settleRest(s.rest, now);
            if (depois === s.rest) return s;
            return commitRest({ ...s, rest: depois }, now);
          }),

        pause: (now = Date.now()) => patch((s) => ({ ...s, rest: pauseRest(s.rest, now) })),
        resume: (now = Date.now()) => patch((s) => ({ ...s, rest: resumeRest(s.rest, now) })),
        adjust: (deltaSeconds, now = Date.now()) =>
          patch((s) => ({ ...s, rest: adjustRest(s.rest, deltaSeconds, now), alerted: deltaSeconds > 0 ? false : s.alerted })),
        /**
         * Pular e dispensar encerram o descanso E somem com ele da tela (§16).
         *
         * Chegar a zero sozinho é diferente: aí o cronômetro FICA visível, avisando que acabou —
         * é o aviso que a pessoa está esperando. Já quem toca em "Pular" ou "Pronto" já voltou pra
         * série, e um painel de descanso no caminho seria só estorvo. O registro é gravado antes
         * de sumir, nos dois casos.
         */
        skip: (now = Date.now()) =>
          patch((s) => ({ ...commitRest({ ...s, rest: skipRest(s.rest, now) }, now), rest: IDLE_REST, restTarget: null })),
        stopRest: (now = Date.now()) =>
          patch((s) => ({ ...commitRest({ ...s, rest: finishRest(s.rest, now) }, now), rest: IDLE_REST, restTarget: null })),
        markAlerted: () => patch((s) => ({ ...s, alerted: true })),

        /**
         * Encerra o treino e move a sessão pra fila de subida.
         *
         * A sessão finalizada NÃO some do aparelho até o servidor confirmar. É a diferença entre
         * "sincroniza quando a rede voltar" e "perdeu o treino porque a academia não tem sinal".
         */
        finish: (now = Date.now()) => {
          const atual = get().session;
          if (!atual) return null;
          const comDescanso = commitRest(atual, now);
          const finalizada: ActiveSession = { ...comDescanso, finishedAt: now, rest: IDLE_REST, restTarget: null };
          set({
            session: null,
            pending: [...get().pending.filter((p) => p.clientId !== finalizada.clientId), finalizada],
            lastFinished: finalizada,
            lastRecords: [],
          });
          return finalizada;
        },

        markSynced: (clientId, records = []) =>
          set({
            pending: get().pending.filter((p) => p.clientId !== clientId),
            ...(get().lastFinished?.clientId === clientId ? { lastRecords: records } : {}),
          }),
      };
    },
    {
      name: "cc_gym_session",
      // A sessão ativa e a fila de subida são justamente o que precisa sobreviver a fechar o app.
      partialize: (s) => ({ session: s.session, pending: s.pending, lastFinished: s.lastFinished, lastRecords: s.lastRecords }),
    },
  ),
);

function formatKg(v: number): string {
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} kg`;
}

/** O payload que sobe pro servidor. Pura tradução — nenhuma conta acontece aqui. */
export function sessionPayload(session: ActiveSession) {
  return {
    clientId: session.clientId,
    workoutId: session.workoutId ?? undefined,
    name: session.name,
    startedAt: new Date(session.startedAt).toISOString(),
    finishedAt: session.finishedAt ? new Date(session.finishedAt).toISOString() : undefined,
    notes: session.notes || undefined,
    sets: session.exercises.flatMap((ex, exerciseOrder) =>
      ex.sets
        // Série que nunca foi tocada não vai pro servidor: ela é uma intenção da ficha, não um
        // acontecimento. Contá-la faria o "28 de 28 séries" mentir em todo treino interrompido.
        .filter((s) => s.completed)
        .map((s) => ({
          exerciseId: ex.exerciseId,
          setNumber: s.setNumber,
          exerciseOrder,
          weight: s.weight,
          reps: s.reps,
          completed: s.completed,
          notes: s.notes || undefined,
          completedAt: s.completedAt,
          ...(s.rest ?? {}),
        })),
    ),
  };
}

/** Volume de UM exercício: Σ carga × repetições das séries concluídas. */
export function exerciseVolume(exercise: ActiveExercise): number {
  return exercise.sets.filter((s) => s.completed).reduce((acc, s) => acc + s.weight * s.reps, 0);
}

/** Progresso do treino, pra barra do topo. */
export function sessionProgress(session: ActiveSession) {
  const total = session.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const feitas = session.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);
  const exerciciosFeitos = session.exercises.filter((e) => e.sets.every((s) => s.completed)).length;
  const volume = session.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).reduce((a, s) => a + s.weight * s.reps, 0),
    0,
  );
  return { totalSets: total, completedSets: feitas, exercises: session.exercises.length, exercisesDone: exerciciosFeitos, volume };
}
