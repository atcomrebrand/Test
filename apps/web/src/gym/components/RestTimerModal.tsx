import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { AlarmClock, Check, Minus, Pause, Play, Plus, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, progress, remainingMs } from "../domain/rest-timer";
import { useGymSessionStore } from "../store/session";
import { useElapsed } from "../useElapsed";

/** Bipe curto via WebAudio: não depende de arquivo, não pesa no bundle e não falha em 404. */
function bipe() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Áudio bloqueado pelo navegador não pode derrubar o treino.
  }
}

/**
 * O descanso como diálogo, sobre a lista de exercícios.
 *
 * Modal e não painel embutido porque o descanso é o único momento do treino em que a pessoa não
 * está fazendo mais nada — ocupar a tela inteira com o tempo é o que a faz enxergar o número de
 * longe, com o celular apoiado no banco. Os controles têm alvo de toque grande pelo mesmo motivo
 * de sempre: mão suada, de pé, uma mão só.
 */
export function RestTimerModal({ soundEnabled, vibrationEnabled }: { soundEnabled: boolean; vibrationEnabled: boolean }) {
  const session = useGymSessionStore((s) => s.session);
  const tick = useGymSessionStore((s) => s.tickRest);
  const pause = useGymSessionStore((s) => s.pause);
  const resume = useGymSessionStore((s) => s.resume);
  const adjust = useGymSessionStore((s) => s.adjust);
  const skip = useGymSessionStore((s) => s.skip);
  const stop = useGymSessionStore((s) => s.stopRest);
  const markAlerted = useGymSessionStore((s) => s.markAlerted);

  const rest = session?.rest;
  const aberto = !!rest && rest.phase !== "IDLE";
  const agora = useElapsed(aberto && rest?.phase === "RUNNING", 100);

  useEffect(() => {
    if (rest?.phase === "RUNNING") tick(agora);
  }, [agora, rest?.phase, tick]);

  const acabou = rest?.phase === "FINISHED";
  useEffect(() => {
    if (!acabou || !session || session.alerted) return;
    markAlerted();
    if (soundEnabled) bipe();
    if (vibrationEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([180, 90, 180]);
  }, [acabou, session, soundEnabled, vibrationEnabled, markAlerted]);

  const restante = rest ? remainingMs(rest, agora) : 0;
  const pct = rest ? progress(rest, agora) : 0;
  const pausado = rest?.phase === "PAUSED";

  return createPortal(
    <AnimatePresence>
      {aberto && rest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70"
            // Tocar fora fecha, como qualquer diálogo — e "fechar" aqui é dispensar o descanso.
            onClick={() => stop()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Descanso"
            className="relative w-full max-w-sm rounded-3xl bg-neutral-800 p-6 text-center text-neutral-50 shadow-2xl"
          >
            <button
              onClick={() => stop()}
              aria-label="Fechar descanso"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className={cn(
                "mx-auto flex h-24 w-24 items-center justify-center rounded-full transition-colors",
                acabou ? "bg-emerald-500" : "bg-sky-500",
              )}
            >
              {acabou ? <Check className="h-11 w-11 text-white" strokeWidth={3} /> : <AlarmClock className="h-11 w-11 text-white" />}
            </div>

            <h2 className="mt-5 text-3xl font-black">{acabou ? "Bora!" : pausado ? "Pausado" : "Muito bom!"}</h2>
            <p className="mt-1 text-base text-neutral-300">
              {acabou ? "Descanso finalizado. Vamos pra próxima série." : pausado ? "O tempo está parado." : "Você finalizou mais uma série. Descanse por:"}
            </p>

            <p className={cn("mt-4 font-mono text-7xl font-black leading-none tabular-nums", acabou && "text-emerald-400")} aria-live="polite">
              {formatClock(restante)}
            </p>

            <div className="mx-auto mt-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-700">
              <motion.div
                className={cn("h-full rounded-full", acabou ? "bg-emerald-400" : "bg-sky-500")}
                animate={{ width: `${pct * 100}%` }}
                transition={{ duration: 0.15, ease: "linear" }}
              />
            </div>

            {/* §14 e §15: ajustar e pausar continuam a um toque, sem esconder o botão principal. */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Secundario onClick={() => adjust(-15)} icon={<Minus className="h-4 w-4" />} label="15s" />
              {pausado ? (
                <Secundario onClick={() => resume()} icon={<Play className="h-4 w-4" />} label="Continuar" />
              ) : acabou ? (
                <Secundario onClick={() => adjust(30)} icon={<Plus className="h-4 w-4" />} label="Mais 30s" />
              ) : (
                <Secundario onClick={() => pause()} icon={<Pause className="h-4 w-4" />} label="Pausar" />
              )}
              <Secundario onClick={() => adjust(15)} icon={<Plus className="h-4 w-4" />} label="15s" />
            </div>

            <button
              onClick={() => (acabou ? stop() : skip())}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-black uppercase tracking-wide transition-colors",
                acabou ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-sky-500 text-white hover:bg-sky-400",
              )}
            >
              {acabou ? <Check className="h-5 w-5" /> : <SkipForward className="h-5 w-5" />}
              {acabou ? "Próxima série" : "Parar cronômetro"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Secundario({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-700 text-xs font-bold text-neutral-200 transition-colors hover:bg-neutral-600"
    >
      {icon}
      {label}
    </button>
  );
}
