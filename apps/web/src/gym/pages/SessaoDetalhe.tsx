import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useGymSession } from "../api";
import { formatDuration, formatMinutes, formatVolume, GYM, MUSCLE_LABEL, RECORD_LABEL } from "../theme";

export default function SessaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: sessao, isLoading } = useGymSession(id);

  if (isLoading || !sessao) return <Skeleton className="h-96 rounded-3xl" />;

  const m = sessao.metrics;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/academia/historico" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Histórico
      </Link>

      <div>
        <h1 className="text-2xl font-black tracking-tight">{sessao.name}</h1>
        <p className="text-sm text-muted">{formatDate(sessao.startedAt, { day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Duração" value={formatMinutes(m.durationSeconds)} />
        <Stat label="Volume" value={formatVolume(m.totalVolume)} />
        <Stat label="Séries" value={`${m.completedSets}`} />
        <Stat label="Descanso médio" value={m.averageRestSeconds === null ? "—" : `${m.averageRestSeconds}s`} />
      </div>

      {sessao.records.length > 0 && (
        <div className={cn("rounded-2xl border p-4", GYM.border, GYM.soft)}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
            <Trophy className={cn("h-3.5 w-3.5", GYM.text)} />
            Recordes deste treino
          </p>
          <ul className="mt-2 space-y-1">
            {sessao.records.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{r.exerciseName}</span>
                <span className={GYM.text}>
                  {RECORD_LABEL[r.kind]}
                  {r.improvement !== null && ` · +${r.improvement}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sessao.exercises.map((ex) => (
        <Card key={ex.exercise.id}>
          <CardContent className="py-4">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{ex.exercise.name}</p>
                <p className="text-xs text-muted">{MUSCLE_LABEL[ex.exercise.primaryMuscle]}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">{ex.sets.length} séries</span>
            </div>

            <ul className="mt-3 space-y-1">
              {ex.sets.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                    s.completed ? "surface-2" : "border border-dashed border-[rgb(var(--border))] text-muted",
                  )}
                >
                  <span className="w-6 text-xs font-bold text-muted">{s.setNumber}</span>
                  <span className="flex-1 font-semibold tabular-nums">
                    {s.weight} kg × {s.reps}
                  </span>
                  {s.restActualSeconds !== null && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Timer className="h-3 w-3" />
                      {formatDuration(s.restActualSeconds)}
                      {s.restWasSkipped && " (pulado)"}
                      {s.restWasPaused && " (pausado)"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  );
}
