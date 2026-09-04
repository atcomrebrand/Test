import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Dumbbell, Flag, Minus, Pencil, Play, Plus, Square, Timer, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useGymProfile } from "../api";
import { RestTimerModal } from "../components/RestTimerModal";
import { NumberField } from "../components/NumberField";
import { ActiveExercise, exerciseVolume, sessionProgress, useGymSessionStore } from "../store/session";
import { formatDuration, formatVolume, GYM, MUSCLE_LABEL } from "../theme";
import { useElapsed } from "../useElapsed";
import { useOnline } from "../useGymSync";

/**
 * O modo treino (§9, §19, §55).
 *
 * A tela é a LISTA de exercícios, com um aberto por vez — e não um exercício isolado com setas.
 * Ver a lista inteira responde "quanto falta" sem navegar, e abrir o próximo é um toque no card
 * dele. Tudo daqui roda no aparelho: nenhuma ação nesta tela espera o servidor, porque na academia
 * a conexão não é confiável e um treino não pode depender dela.
 */
export default function Executar() {
  const navigate = useNavigate();
  const session = useGymSessionStore((s) => s.session);
  const { data: perfil } = useGymProfile();

  const toggleExercise = useGymSessionStore((s) => s.toggleExercise);
  const finish = useGymSessionStore((s) => s.finish);
  const discard = useGymSessionStore((s) => s.discard);

  const [confirmando, setConfirmando] = useState(false);
  const [abandonando, setAbandonando] = useState(false);
  /** Encerrando por vontade da pessoa, e não por falta de sessão — ver a guarda logo abaixo. */
  const [encerrando, setEncerrando] = useState(false);
  const online = useOnline();
  const agora = useElapsed(!!session, 500);

  useEffect(() => {
    if (!session && !encerrando) navigate("/academia/treinos", { replace: true });
  }, [session, encerrando, navigate]);

  const progresso = useMemo(() => (session ? sessionProgress(session) : null), [session]);
  if (!session || !progresso) return null;

  const decorrido = Math.floor((agora - session.startedAt) / 1000);

  function concluirTreino() {
    setEncerrando(true);
    const finalizada = finish();
    setConfirmando(false);
    navigate(finalizada ? `/academia/resumo/${finalizada.clientId}` : "/academia/treinos", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 pb-[env(safe-area-inset-bottom)] text-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 px-4 pt-[calc(0.75rem_+_env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setAbandonando(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800"
            aria-label="Sair do treino"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{session.name}</p>
            <p className="font-mono text-2xl font-black leading-tight tabular-nums">{formatDuration(decorrido)}</p>
          </div>

          <button
            onClick={() => setConfirmando(true)}
            className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-neutral-900", GYM.solid)}
          >
            <Flag className="h-4 w-4" />
            Fim
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-lime-500 transition-all"
              style={{ width: `${progresso.totalSets > 0 ? (progresso.completedSets / progresso.totalSets) * 100 : 0}%` }}
            />
          </div>
          <p className="shrink-0 text-xs font-semibold text-neutral-400">
            {progresso.exercisesDone}/{progresso.exercises} exercícios
          </p>
        </div>

        {!online && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-center text-[11px] font-medium text-amber-400">
            Sem conexão — o treino continua normal e sobe sozinho depois.
          </p>
        )}
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {session.exercises.map((ex, i) => (
          <CardExercicio
            key={ex.exerciseId}
            exercicio={ex}
            index={i}
            aberto={session.currentIndex === i}
            onToggle={() => toggleExercise(i)}
          />
        ))}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Volume total do treino</p>
          <p className="mt-1 text-2xl font-black">{formatVolume(progresso.volume)}</p>
        </div>
      </main>

      <RestTimerModal soundEnabled={perfil?.soundEnabled ?? true} vibrationEnabled={perfil?.vibrationEnabled ?? true} />

      <ConfirmModal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title="Finalizar treino"
        confirmLabel="Finalizar"
        onConfirm={concluirTreino}
        description={
          progresso.completedSets < progresso.totalSets
            ? `Faltam ${progresso.totalSets - progresso.completedSets} série(s). O treino é gravado com o que você fez até aqui.`
            : "Todas as séries concluídas. Bora ver o resumo."
        }
      />

      <ConfirmModal
        open={abandonando}
        onClose={() => setAbandonando(false)}
        title="Sair sem gravar?"
        confirmLabel="Descartar treino"
        onConfirm={() => {
          setEncerrando(true);
          discard();
          setAbandonando(false);
          navigate("/academia/treinos", { replace: true });
        }}
        description="As séries desta sessão são perdidas. Pra guardar o que já fez, use Finalizar."
      />
    </div>
  );
}

/** O cartão de um exercício: fechado mostra o essencial, aberto vira a área de execução. */
function CardExercicio({
  exercicio,
  index,
  aberto,
  onToggle,
}: {
  exercicio: ActiveExercise;
  index: number;
  aberto: boolean;
  onToggle: () => void;
}) {
  const setAutoAdvance = useGymSessionStore((s) => s.setAutoAdvance);
  const addSet = useGymSessionStore((s) => s.addSet);
  const removeSet = useGymSessionStore((s) => s.removeSet);
  const beginRest = useGymSessionStore((s) => s.beginRest);
  const [obsAberta, setObsAberta] = useState(false);

  const volume = exerciseVolume(exercicio);
  const concluido = exercicio.sets.every((s) => s.completed);
  const feitas = exercicio.sets.filter((s) => s.completed).length;

  return (
    <div className={cn("overflow-hidden rounded-2xl border", concluido ? "border-emerald-500/40" : "border-neutral-800")}>
      <div className="flex items-start gap-3 bg-neutral-800/60 p-3">
        <Thumb exercicio={exercicio} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-400">Exercício:</p>
          <p className="text-lg font-bold leading-tight">{exercicio.name}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Volume total do exercício: {formatVolume(volume)}</p>
        </div>
        <button
          onClick={onToggle}
          aria-expanded={aberto}
          aria-label={aberto ? `Recolher ${exercicio.name}` : `Abrir ${exercicio.name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-700/70 text-neutral-200"
        >
          {aberto ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>

      {!aberto && (
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-center gap-2 py-3.5 text-base font-semibold transition-colors",
            concluido ? "bg-emerald-500/15 text-emerald-400" : "bg-lime-500 text-neutral-900 hover:bg-lime-400",
          )}
        >
          {concluido ? (
            <>
              <Check className="h-5 w-5" />
              Exercício concluído
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              {feitas > 0 ? "Continuar exercício" : "Iniciar exercício"}
            </>
          )}
        </button>
      )}

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-neutral-800/40"
          >
            <div className="space-y-4 p-3">
              {/* Faixa de mídia. O catálogo ainda não tem foto nem vídeo — quando tiver, entra aqui
                  sem mexer no resto: o espaço já está reservado e legendado. */}
              <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
                {exercicio.image ? (
                  <img src={exercicio.image} alt={exercicio.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-neutral-600">
                    <Dumbbell className="h-9 w-9" />
                    <span className="text-xs font-medium">{MUSCLE_LABEL[exercicio.primaryMuscle]}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                  <p className="text-2xl font-black leading-none">
                    {exercicio.sets.length} <span className="text-sm font-semibold">Série(s)</span>
                  </p>
                  <p className="text-2xl font-black leading-none">
                    {exercicio.restSeconds} <span className="text-sm font-semibold">descanso</span>
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl bg-neutral-100 text-neutral-900">
                <button
                  onClick={() => setObsAberta((v) => !v)}
                  aria-expanded={obsAberta}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-medium"
                >
                  <Pencil className="h-4 w-4 shrink-0 text-neutral-500" />
                  <span className="flex-1">Observações do Exercício</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", obsAberta && "rotate-180")} />
                </button>
                {obsAberta && (
                  <p className="border-t border-neutral-300 px-3 py-3 text-sm">
                    {exercicio.notes || <span className="text-neutral-500">Nenhuma observação para este exercício.</span>}
                  </p>
                )}
              </div>

              <button
                onClick={() => setAutoAdvance(index, !exercicio.autoAdvance)}
                role="switch"
                aria-checked={exercicio.autoAdvance}
                className="flex w-full items-center gap-3 text-left text-sm font-medium"
              >
                <span
                  className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full border-2 border-neutral-500 transition-colors",
                    exercicio.autoAdvance ? "bg-lime-500" : "bg-neutral-700",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all",
                      exercicio.autoAdvance ? "left-[1.625rem]" : "left-0.5",
                    )}
                  />
                </span>
                Execução automática das séries
              </button>

              <p className="text-center text-sm text-neutral-300">Execute as séries abaixo até concluir o exercício</p>

              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                {exercicio.sets.map((serie) => (
                  <CartaoSerie key={serie.setNumber} exerciseIndex={index} serie={serie} />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => addSet(index)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-700 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-600"
                >
                  <Plus className="h-4 w-4" />
                  Série
                </button>
                {exercicio.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(index)}
                    className="flex items-center justify-center rounded-xl bg-neutral-700 px-4 py-2.5 text-neutral-300 hover:bg-neutral-600"
                    aria-label="Remover última série"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
                {/* Descanso manual (§13): nem todo descanso vem de concluir uma série. */}
                <button
                  onClick={() => beginRest(exercicio.restSeconds, null)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-600"
                >
                  <Timer className="h-4 w-4" />
                  Descansar
                </button>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-semibold text-neutral-300">Histórico de séries / Cargas</p>
                {exercicio.lastSets.length === 0 ? (
                  <p className="rounded-xl bg-neutral-900 px-3 py-3 text-xs text-neutral-500">
                    Primeira vez neste exercício — o histórico começa a partir de hoje.
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-800 rounded-xl bg-neutral-900 px-3">
                    {exercicio.lastSets.map((s) => (
                      <li key={s.setNumber} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-neutral-400">Série {s.setNumber}</span>
                        <span className="font-semibold tabular-nums">
                          {s.reps} Rep. · {formatKg(s.weight)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * O cartão de uma série: repetições, carga e um botão que percorre ▶ → ⏹ → ✓.
 *
 * Começar e parar em vez de um único ✓ é o que dá ao app o tempo real de execução da série — e é
 * o gesto do app que serviu de referência. Quem não quiser dois toques liga a execução automática:
 * aí só o ⏹ é necessário, e a série seguinte já entra em execução sozinha.
 */
function CartaoSerie({ exerciseIndex, serie }: { exerciseIndex: number; serie: { setNumber: number; weight: number; reps: number; completed: boolean; startedAt?: number } }) {
  const startSet = useGymSessionStore((s) => s.startSet);
  const completeSet = useGymSessionStore((s) => s.completeSet);
  const uncompleteSet = useGymSessionStore((s) => s.uncompleteSet);
  const updateSet = useGymSessionStore((s) => s.updateSet);

  const executando = !!serie.startedAt && !serie.completed;

  return (
    <div
      className={cn(
        "w-32 shrink-0 overflow-hidden rounded-xl border",
        serie.completed ? "border-emerald-500/50 bg-emerald-500/10" : executando ? "border-lime-500/60 bg-neutral-900" : "border-neutral-700 bg-neutral-900",
      )}
    >
      <div className="px-2 py-2 text-center">
        <p className="text-sm font-bold">Série {serie.setNumber}</p>
        <label className="mt-1 flex items-baseline justify-center gap-1">
          <NumberField
            value={serie.reps}
            onChange={(reps) => updateSet(exerciseIndex, serie.setNumber, { reps })}
            min={0}
            max={500}
            aria-label={`Repetições da série ${serie.setNumber}`}
            className="w-10 text-right text-base font-semibold"
          />
          <span className="text-xs text-neutral-400">Rep.</span>
        </label>
        <label className="flex items-baseline justify-center gap-1">
          <NumberField
            value={serie.weight}
            onChange={(weight) => updateSet(exerciseIndex, serie.setNumber, { weight })}
            min={0}
            max={2000}
            decimal
            aria-label={`Carga da série ${serie.setNumber}`}
            className="w-12 text-right text-base font-semibold"
          />
          <span className="text-xs text-neutral-400">kg</span>
        </label>
      </div>

      <button
        onClick={() => {
          if (serie.completed) return uncompleteSet(exerciseIndex, serie.setNumber);
          if (executando) return completeSet(exerciseIndex, serie.setNumber);
          startSet(exerciseIndex, serie.setNumber);
        }}
        aria-label={
          serie.completed
            ? `Desmarcar série ${serie.setNumber}`
            : executando
              ? `Concluir série ${serie.setNumber}`
              : `Iniciar série ${serie.setNumber}`
        }
        aria-pressed={serie.completed}
        className={cn(
          "flex h-12 w-full items-center justify-center transition-colors",
          serie.completed ? "bg-emerald-500 text-white" : "bg-lime-500 text-neutral-900 hover:bg-lime-400",
        )}
      >
        {serie.completed ? (
          <Check className="h-6 w-6" strokeWidth={3} />
        ) : executando ? (
          <Square className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-6 w-6 fill-current" />
        )}
      </button>
    </div>
  );
}

function Thumb({ exercicio }: { exercicio: ActiveExercise }) {
  if (exercicio.image) {
    return <img src={exercicio.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-neutral-600">
      <Dumbbell className="h-7 w-7" />
    </div>
  );
}

function formatKg(v: number): string {
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} kg`;
}
