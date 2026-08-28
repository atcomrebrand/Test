import { useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Minus, Pause, Play, Plus, SkipForward } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, progress, remainingMs } from "../domain/rest-timer";
import { useGymSessionStore } from "../store/session";
import { useElapsed } from "../useElapsed";
import { GYM } from "../theme";

/** Bipe curto via WebAudio: não depende de arquivo, não pesa no bundle e não falha em 404. */
function bipe() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
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

interface Props {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

/**
 * O componente do descanso (§11).
 *
 * Os controles têm área de toque grande de propósito: quem usa isso está de pé, suado, com uma mão
 * só e o celular apoiado em qualquer lugar. Botão pequeno aqui é botão que erra.
 */
export function RestTimer({ soundEnabled, vibrationEnabled }: Props) {
  const session = useGymSessionStore((s) => s.session);
  const tick = useGymSessionStore((s) => s.tickRest);
  const pause = useGymSessionStore((s) => s.pause);
  const resume = useGymSessionStore((s) => s.resume);
  const adjust = useGymSessionStore((s) => s.adjust);
  const skip = useGymSessionStore((s) => s.skip);
  const stop = useGymSessionStore((s) => s.stopRest);
  const markAlerted = useGymSessionStore((s) => s.markAlerted);

  const rest = session?.rest;
  const ativo = !!rest && rest.phase !== "IDLE";
  const agora = useElapsed(ativo && rest?.phase === "RUNNING", 100);

  // O relógio nunca conta: só pergunta se o instante já passou.
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

  if (!session || !rest || rest.phase === "IDLE") return null;

  const restante = remainingMs(rest, agora);
  const pct = progress(rest, agora);
  const pausado = rest.phase === "PAUSED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl border p-5",
        acabou ? "border-lime-500/60 bg-lime-500/10" : "border-neutral-800 bg-neutral-900",
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className={cn("text-xs font-bold uppercase tracking-[0.2em]", acabou ? GYM.text : "text-neutral-400")}>
          {acabou ? "Descanso finalizado" : pausado ? "Descanso pausado" : "Descanso"}
        </p>
        <p className="text-xs text-neutral-500">
          {formatClock(rest.durationMs)} configurado
          {rest.adjustmentMs !== 0 && ` · ${rest.adjustmentMs > 0 ? "+" : "−"}${Math.abs(Math.round(rest.adjustmentMs / 1000))}s`}
        </p>
      </div>

      <p
        className={cn(
          "mt-1 font-mono text-6xl font-black leading-none tabular-nums",
          acabou ? "text-lime-400" : pausado ? "text-neutral-500" : "text-neutral-50",
        )}
        aria-live="polite"
      >
        {formatClock(restante)}
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
        <motion.div
          className={cn("h-full rounded-full", acabou ? "bg-lime-400" : "bg-lime-500")}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.15, ease: "linear" }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <TimerButton label="−15s" onClick={() => adjust(-15)} icon={<Minus className="h-4 w-4" />} />
        {acabou ? (
          <TimerButton label="Pronto" onClick={() => stop()} icon={<Check className="h-4 w-4" />} primary />
        ) : pausado ? (
          <TimerButton label="Continuar" onClick={() => resume()} icon={<Play className="h-4 w-4" />} primary />
        ) : (
          <TimerButton label="Pausar" onClick={() => pause()} icon={<Pause className="h-4 w-4" />} />
        )}
        <TimerButton label="+15s" onClick={() => adjust(15)} icon={<Plus className="h-4 w-4" />} />
        {/* Pular não pede confirmação (§16): quem já está na próxima série não pode ser interrompido. */}
        <TimerButton label="Pular" onClick={() => skip()} icon={<SkipForward className="h-4 w-4" />} />
      </div>
    </motion.div>
  );
}

function TimerButton({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // min-h-16: alvo de toque grande, o requisito explícito do §50 pros controles do cronômetro.
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-colors",
        primary ? "bg-lime-500 text-neutral-900 hover:bg-lime-400" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
