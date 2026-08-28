import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Flag, Minus, Plus, Timer, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useGymProfile } from "../api";
import { RestTimer } from "../components/RestTimer";
import { sessionProgress, useGymSessionStore } from "../store/session";
import { formatDuration, formatVolume, GYM, MUSCLE_LABEL } from "../theme";
import { useElapsed } from "../useElapsed";
import { useOnline } from "../useGymSync";

/**
 * O modo treino (§9, §19, §55).
 *
 * Tela cheia, escura, com o que importa sempre visível: cronômetro da sessão, progresso e a série
 * atual. Tudo daqui roda **no aparelho** — nenhuma ação nesta tela espera o servidor, porque na
 * academia a conexão simplesmente não é confiável e um treino não pode depender dela.
 */
export default function Executar() {
  const navigate = useNavigate();
  const session = useGymSessionStore((s) => s.session);
  const { data: perfil } = useGymProfile();

  const setCurrentIndex = useGymSessionStore((s) => s.setCurrentIndex);
  const updateSet = useGymSessionStore((s) => s.updateSet);
  const completeSet = useGymSessionStore((s) => s.completeSet);
  const uncompleteSet = useGymSessionStore((s) => s.uncompleteSet);
  const addSet = useGymSessionStore((s) => s.addSet);
  const removeSet = useGymSessionStore((s) => s.removeSet);
  const beginRest = useGymSessionStore((s) => s.beginRest);
  const finish = useGymSessionStore((s) => s.finish);
  const discard = useGymSessionStore((s) => s.discard);

  const [confirmando, setConfirmando] = useState(false);
  const [abandonando, setAbandonando] = useState(false);
  /**
   * Encerrando por vontade da pessoa, e não por falta de sessão.
   *
   * Sem isso a guarda logo abaixo dispara no instante em que `finish()` zera a sessão e joga a
   * pessoa na lista de treinos — atropelando a navegação pro resumo, que acontece na mesma ação.
   * Era o final feliz do fluxo caindo na saída de emergência.
   */
  const [encerrando, setEncerrando] = useState(false);
  const online = useOnline();
  const agora = useElapsed(!!session, 500);

  // Sem sessão ativa não há o que executar — volta pra lista em vez de mostrar tela vazia.
  useEffect(() => {
    if (!session && !encerrando) navigate("/academia/treinos", { replace: true });
  }, [session, encerrando, navigate]);

  const progresso = useMemo(() => (session ? sessionProgress(session) : null), [session]);
  if (!session || !progresso) return null;

  const exercicio = session.exercises[session.currentIndex];
  const decorrido = Math.floor((agora - session.startedAt) / 1000);
  const descansando = session.rest.phase !== "IDLE";

  function concluirTreino() {
    setEncerrando(true);
    const finalizada = finish();
    setConfirmando(false);
    if (finalizada) navigate(`/academia/resumo/${finalizada.clientId}`, { replace: true });
    else navigate("/academia/treinos", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 pb-[env(safe-area-inset-bottom)] text-neutral-50">
      {/* Cabeçalho fixo: cronômetro e progresso nunca sobem com a rolagem (§19). */}
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

      <main className="flex-1 space-y-4 px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={exercicio.exerciseId}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5">
              <p className={cn("text-xs font-bold uppercase tracking-[0.2em]", GYM.text)}>
                {MUSCLE_LABEL[exercicio.primaryMuscle]}
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight">{exercicio.name}</h1>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-neutral-400">
                  Meta{" "}
                  <strong className="text-neutral-100">
                    {exercicio.sets.length} × {exercicio.targetRepsMin}
                    {exercicio.targetRepsMax !== exercicio.targetRepsMin && `–${exercicio.targetRepsMax}`}
                  </strong>
                </span>
                {exercicio.lastLabel && (
                  <span className="text-neutral-400">
                    Última vez <strong className="text-neutral-100">{exercicio.lastLabel}</strong>
                  </span>
                )}
                <span className="text-neutral-400">
                  Descanso <strong className="text-neutral-100">{exercicio.restSeconds}s</strong>
                </span>
              </div>

              {exercicio.notes && <p className="mt-3 rounded-xl bg-neutral-800 p-3 text-sm text-neutral-300">{exercicio.notes}</p>}

              <div className="mt-5 space-y-2">
                {exercicio.sets.map((serie) => (
                  <SetRow
                    key={serie.setNumber}
                    number={serie.setNumber}
                    weight={serie.weight}
                    reps={serie.reps}
                    completed={serie.completed}
                    onChange={(patch) => updateSet(session.currentIndex, serie.setNumber, patch)}
                    onToggle={() =>
                      serie.completed
                        ? uncompleteSet(session.currentIndex, serie.setNumber)
                        : completeSet(session.currentIndex, serie.setNumber)
                    }
                  />
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => addSet(session.currentIndex)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-800 py-2.5 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
                >
                  <Plus className="h-4 w-4" />
                  Série
                </button>
                {exercicio.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(session.currentIndex)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-400 hover:bg-neutral-700"
                    aria-label="Remover última série"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
                {/* Descanso manual (§13): nem todo descanso vem de concluir uma série. */}
                {!descansando && (
                  <button
                    onClick={() => beginRest(exercicio.restSeconds, null)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
                  >
                    <Timer className="h-4 w-4" />
                    Descansar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <RestTimer soundEnabled={perfil?.soundEnabled ?? true} vibrationEnabled={perfil?.vibrationEnabled ?? true} />

        {/* Navegação entre exercícios: sempre ao alcance do polegar, nunca obrigatória. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex(session.currentIndex - 1)}
            disabled={session.currentIndex === 0}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-300 disabled:opacity-30"
            aria-label="Exercício anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {session.exercises.map((ex, i) => {
              const feito = ex.sets.every((s) => s.completed);
              return (
                <button
                  key={ex.exerciseId}
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Ir para ${ex.name}`}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    i === session.currentIndex ? "w-6 bg-lime-500" : feito ? "w-2.5 bg-lime-500/40" : "w-2.5 bg-neutral-700",
                  )}
                />
              );
            })}
          </div>

          <button
            onClick={() => setCurrentIndex(session.currentIndex + 1)}
            disabled={session.currentIndex >= session.exercises.length - 1}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-300 disabled:opacity-30"
            aria-label="Próximo exercício"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Volume até agora</p>
          <p className="mt-1 text-2xl font-black">{formatVolume(progresso.volume)}</p>
        </div>
      </main>

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

/**
 * Uma linha de série.
 *
 * Campos grandes e `inputMode="decimal"` porque é digitado de pé, com o polegar, e o teclado tem
 * que abrir já no numérico. O ✓ é o botão maior da linha: é o único que se aperta em toda série.
 */
function SetRow({
  number,
  weight,
  reps,
  completed,
  onChange,
  onToggle,
}: {
  number: number;
  weight: number;
  reps: number;
  completed: boolean;
  onChange: (patch: { weight?: number; reps?: number }) => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border p-2 transition-colors",
        completed ? "border-lime-500/40 bg-lime-500/10" : "border-neutral-800 bg-neutral-950",
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold text-neutral-500">{number}</span>

      <label className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-neutral-900 px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={String(weight).replace(".", ",")}
          onChange={(e) => onChange({ weight: Number(e.target.value.replace(",", ".")) || 0 })}
          className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none"
          aria-label={`Carga da série ${number}`}
        />
        <span className="shrink-0 text-xs font-semibold text-neutral-500">kg</span>
      </label>

      <label className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-neutral-900 px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={String(reps)}
          onChange={(e) => onChange({ reps: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none"
          aria-label={`Repetições da série ${number}`}
        />
        <span className="shrink-0 text-xs font-semibold text-neutral-500">reps</span>
      </label>

      <button
        onClick={onToggle}
        aria-label={completed ? `Desmarcar série ${number}` : `Concluir série ${number}`}
        aria-pressed={completed}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
          completed ? "bg-lime-500 text-neutral-900" : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700",
        )}
      >
        <Check className="h-6 w-6" strokeWidth={3} />
      </button>
    </div>
  );
}
