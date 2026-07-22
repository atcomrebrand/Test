import { Link, useLocation } from "react-router-dom";
import { Pause, Play, Square } from "lucide-react";
import { useActiveSession, usePauseSession, useResumeSession, useFinishSession } from "../api";
import { useLiveElapsed } from "../hooks/useLiveElapsed";
import { formatHMS } from "../lib/sessionTime";

/**
 * Mounted inside TrackingLayout so it shows on every screen of the Horas module — Dashboard,
 * Sessões, Calendário, etc. — whenever a work session is active, but never leaks into Parcelas or
 * Investimentos. Hidden on the Modo Foco screen itself, which already shows the full controls.
 */
export function FloatingTimerBar() {
  const location = useLocation();
  const { data: session } = useActiveSession();
  const pause = usePauseSession();
  const resume = useResumeSession();
  const finish = useFinishSession();
  const live = useLiveElapsed(session);

  if (!session || !live || location.pathname === "/horas") return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[rgb(var(--border))] surface px-4 py-3 shadow-elevated md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${session.status === "RUNNING" ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />
      <Link to="/horas" className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted">
          {session.status === "RUNNING" ? "Trabalhando" : "Pausado"} · {session.job.company}
        </p>
        <p className="font-mono text-sm font-bold tabular-nums">{formatHMS(live.netSeconds)}</p>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {session.status === "RUNNING" ? (
          <button onClick={() => pause.mutate(session.id)} className="rounded-lg p-2 text-muted hover:surface-2" aria-label="Pausar">
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => resume.mutate(session.id)} className="rounded-lg p-2 text-muted hover:surface-2" aria-label="Retomar">
            <Play className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => finish.mutate({ id: session.id })}
          className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
          aria-label="Finalizar"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
