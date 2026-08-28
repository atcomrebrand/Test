import { Link, useLocation } from "react-router-dom";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { useGymSessionStore, sessionProgress } from "../store/session";
import { useElapsed } from "../useElapsed";
import { formatDuration, GYM } from "../theme";

/**
 * A faixa de "treino em andamento".
 *
 * Existe porque sair do modo treino pra consultar um exercício é normal — e voltar não pode custar
 * navegação. Some sozinha durante a execução, onde ela seria redundante.
 */
export function ActiveSessionBar() {
  const session = useGymSessionStore((s) => s.session);
  const location = useLocation();
  const agora = useElapsed(!!session);

  if (!session || location.pathname.startsWith("/academia/executar")) return null;

  const { completedSets, totalSets } = sessionProgress(session);
  const decorrido = Math.floor((agora - session.startedAt) / 1000);

  return (
    <Link
      to="/academia/executar"
      className={cn(
        "fixed inset-x-3 bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg md:inset-x-auto md:right-6 md:w-80",
        GYM.solid,
      )}
    >
      <Play className="h-5 w-5 shrink-0 fill-current" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">{session.name}</p>
        <p className="text-xs font-medium opacity-80">
          {formatDuration(decorrido)} · {completedSets}/{totalSets} séries
        </p>
      </div>
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide">Voltar</span>
    </Link>
  );
}
