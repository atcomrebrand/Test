import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CloudOff, Dumbbell, Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useGymSessionStore } from "../store/session";
import { useGymSync } from "../useGymSync";
import { formatDuration, formatVolume, GYM, RECORD_LABEL } from "../theme";

/**
 * Tela de conclusão (§21).
 *
 * Lê a sessão do **aparelho**, não do servidor: acabar o treino não pode depender de a subida ter
 * dado certo. Se a rede estiver fora, o resumo aparece igual e a sessão sobe sozinha depois — o
 * aviso diz isso em vez de esconder.
 */
export default function ResumoTreino() {
  const { clientId } = useParams<{ clientId: string }>();
  const lastFinished = useGymSessionStore((s) => s.lastFinished);
  const records = useGymSessionStore((s) => s.lastRecords);
  const { pendingCount, syncing } = useGymSync();

  // Sempre a sessão do aparelho: ela continua aqui mesmo depois de subir, então o resumo não pisca
  // e nem depende de a rede ter funcionado.
  const local = lastFinished?.clientId === clientId ? lastFinished : null;

  const metricas = useMemo(() => {
    if (!local) return null;
    const seriesFeitas = local.exercises.flatMap((e) => e.sets.filter((s) => s.completed));
    const volume = seriesFeitas.reduce((acc, s) => acc + s.weight * s.reps, 0);
    const descansos = seriesFeitas.map((s) => s.rest?.restActualSeconds).filter((v): v is number => typeof v === "number");
    return {
      volume,
      sets: seriesFeitas.length,
      plannedSets: local.exercises.reduce((acc, e) => acc + e.sets.length, 0),
      exercises: new Set(seriesFeitas.length > 0 ? local.exercises.filter((e) => e.sets.some((s) => s.completed)).map((e) => e.exerciseId) : []).size,
      duration: local.finishedAt ? Math.round((local.finishedAt - local.startedAt) / 1000) : null,
      restTotal: descansos.reduce((a, b) => a + b, 0),
      restAverage: descansos.length > 0 ? Math.round(descansos.reduce((a, b) => a + b, 0) / descansos.length) : null,
    };
  }, [local]);

  if (!local || !metricas) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <Trophy className={cn("mx-auto h-10 w-10", GYM.text)} />
        <h1 className="mt-3 text-2xl font-black">Treino gravado</h1>
        <p className="mt-2 text-sm text-muted">Ele já está no seu histórico.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/academia/historico">
            <Button variant="ghost">Ver histórico</Button>
          </Link>
          <Link to="/academia">
            <Button>Início</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg space-y-4">
      <div className="text-center">
        <p className="text-4xl">🔥</p>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Treino concluído</h1>
        <p className="mt-1 text-sm text-muted">{local.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Tempo" value={formatDuration(metricas.duration)} icon={<Timer className="h-4 w-4" />} />
        <Stat label="Volume" value={formatVolume(metricas.volume)} icon={<Dumbbell className="h-4 w-4" />} highlight />
        <Stat label="Exercícios" value={String(metricas.exercises)} />
        <Stat label="Séries" value={`${metricas.sets} de ${metricas.plannedSets}`} />
        <Stat label="Descanso total" value={formatDuration(metricas.restTotal)} />
        <Stat label="Descanso médio" value={metricas.restAverage === null ? "—" : `${metricas.restAverage}s`} />
      </div>

      {records.length > 0 && (
        <div className={cn("rounded-2xl border p-4", GYM.border, GYM.soft)}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em]">
            <Trophy className={cn("h-4 w-4", GYM.text)} />
            Novos recordes
          </p>
          <ul className="mt-2 space-y-1.5">
            {records.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{r.exerciseName}</span>
                <span className={GYM.text}>
                  {RECORD_LABEL[r.kind]} {r.improvement !== null && `· +${r.improvement}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingCount > 0 && (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <CloudOff className="h-4 w-4" />
          {syncing ? "Enviando o treino..." : "Guardado no aparelho — sobe sozinho quando a conexão voltar."}
        </p>
      )}

      <div className="flex gap-2">
        <Link to="/academia/historico" className="flex-1">
          <Button variant="ghost" className="w-full">Ver detalhes</Button>
        </Link>
        <Link to="/academia" className="flex-1">
          <Button className="w-full">Finalizar</Button>
        </Link>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-[rgb(var(--border))] p-4", highlight && cn(GYM.soft, GYM.border))}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
