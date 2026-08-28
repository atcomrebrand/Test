import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Dumbbell, Play, Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/auth";
import { formatDate } from "@/lib/format";
import { useGymHome, useWorkoutPrefill } from "../api";
import { useGymSessionStore } from "../store/session";
import { useGymSync } from "../useGymSync";
import { formatMinutes, formatVolume, GYM, MUSCLE_LABEL, RECORD_LABEL } from "../theme";
import { ProgressRange } from "../types";
import { OnboardingCard } from "../components/OnboardingCard";
import { TrainingCalendar } from "../components/TrainingCalendar";
import { WeekStrip } from "../components/WeekStrip";

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: "WEEK", label: "Semana" },
  { value: "MONTH", label: "Mês" },
  { value: "M3", label: "3M" },
  { value: "M6", label: "6M" },
  { value: "YEAR", label: "Ano" },
];

export default function Inicio() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [range, setRange] = useState<ProgressRange>("MONTH");
  const { data, isLoading } = useGymHome(range);
  const sessaoAtiva = useGymSessionStore((s) => s.session);
  useGymSync();

  if (isLoading || !data) return <Skeleton className="h-96 rounded-3xl" />;
  if (!data.onboarded) return <OnboardingCard />;

  const nome = user?.name?.split(" ")[0] ?? "atleta";
  // Comparado em UTC, que é como as datas da semana chegam do servidor.
  const agora = new Date();
  const hojeIso = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Olá, {nome}</h1>
        <p className="text-sm text-muted">Pronto para treinar?</p>
      </header>

      {data.nextWorkout ? (
        <ProximoTreino workout={data.nextWorkout} bloqueado={!!sessaoAtiva} onStart={() => navigate("/academia/executar")} />
      ) : (
        <EmptyState
          icon={<Dumbbell className="h-7 w-7" />}
          title="Nenhum treino montado ainda"
          description="Monte sua primeira ficha escolhendo os exercícios, séries, repetições e o descanso de cada um."
          action={
            <Link to="/academia/treinos/novo">
              <Button>Montar treino</Button>
            </Link>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <WeekStrip days={data.weekDays} today={hojeIso} />

            <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <CalendarCheck className="h-3.5 w-3.5" />
                Meta da semana
              </p>
              <p className="mt-1 text-3xl font-black">
                {data.week.done}
                <span className="text-lg text-muted"> / {data.week.target}</span>
                <span className="ml-2 text-sm font-semibold text-muted">treinos</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full surface-2">
                <div
                  className="h-full rounded-full bg-lime-500 transition-all"
                  style={{ width: `${Math.min(100, data.week.target > 0 ? (data.week.done / data.week.target) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {formatMinutes(data.week.minutes * 60)} treinados · {formatVolume(data.week.volume)} de volume
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Volume</p>
              <div className="flex gap-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                      range === r.value ? cn("surface-2", GYM.text) : "text-muted hover:surface-2",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {data.volumeSeries.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">Sem treino nesse período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={data.volumeSeries} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gymVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GYM.hex} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={GYM.hex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 12 }}
                    labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })}
                    formatter={(v: number) => [formatVolume(v), "Volume"]}
                  />
                  <Area type="monotone" dataKey="value" stroke={GYM.hex} strokeWidth={2} fill="url(#gymVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <TrainingCalendar />
        </CardContent>
      </Card>

      {data.lastSession && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Último treino</p>
              <p className="truncate text-lg font-bold">{data.lastSession.name}</p>
              <p className="text-xs text-muted">
                {formatDate(data.lastSession.startedAt)} · {formatMinutes(data.lastSession.durationSeconds)} ·{" "}
                {formatVolume(data.lastSession.totalVolume)} · {data.lastSession.exerciseCount} exercícios
              </p>
            </div>
            <Link to={`/academia/historico/${data.lastSession.id}`}>
              <Button variant="ghost">Ver treino</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.recentRecords.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <Trophy className="h-3.5 w-3.5" />
              Recordes recentes
            </p>
            <ul className="mt-2 divide-y divide-[rgb(var(--border))]">
              {data.recentRecords.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.exerciseName}</p>
                    <p className="text-xs text-muted">
                      {r.weight} kg × {r.reps} · {RECORD_LABEL[r.kind]}
                    </p>
                  </div>
                  {r.improvement !== null && (
                    <span className={cn("shrink-0 text-sm font-bold", GYM.text)}>
                      +{r.improvement}
                      {r.kind === "REPS_NO_PESO" ? " reps" : " kg"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** O card principal da Home: o treino de hoje e um botão grande (§5). */
function ProximoTreino({ workout, bloqueado, onStart }: { workout: any; bloqueado: boolean; onStart: () => void }) {
  const start = useGymSessionStore((s) => s.start);
  const { data: prefill, isFetching } = useWorkoutPrefill(workout.id);

  return (
    <div className={cn("rounded-3xl border p-5", GYM.border, GYM.soft)}>
      <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", GYM.text)}>Treino de hoje</p>
      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">{workout.name}</h2>
      <p className="text-sm text-muted">{workout.description ?? workout.muscles.map((m: keyof typeof MUSCLE_LABEL) => MUSCLE_LABEL[m]).join(" + ")}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 text-muted">
          <Dumbbell className="h-4 w-4" />
          {workout.exerciseCount} exercícios
        </span>
        <span className="text-muted">{workout.totalSets} séries</span>
        <span className="flex items-center gap-1.5 text-muted">
          <Timer className="h-4 w-4" />~{Math.round(workout.estimatedSeconds / 60)} min
        </span>
      </div>

      <button
        onClick={() => {
          if (bloqueado) return onStart();
          if (!prefill) return;
          start(prefill);
          onStart();
        }}
        disabled={isFetching && !prefill && !bloqueado}
        className={cn(
          "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black uppercase tracking-wide text-neutral-900 transition-colors disabled:opacity-60",
          GYM.solid,
          GYM.solidHover,
        )}
      >
        <Play className="h-5 w-5 fill-current" />
        {bloqueado ? "Voltar ao treino" : "Iniciar treino"}
      </button>
    </div>
  );
}
