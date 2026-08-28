import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { usePrivacyStore } from "@/store/privacy";
import { useGymProgress, useGymRecords } from "../api";
import { formatMinutes, formatVolume, GYM, RECORD_LABEL } from "../theme";
import { ProgressRange } from "../types";
import { Medidas } from "../components/Medidas";
import { Fotos } from "../components/Fotos";
import { Metas } from "../components/Metas";

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: "MONTH", label: "Mês" },
  { value: "M3", label: "3M" },
  { value: "M6", label: "6M" },
  { value: "YEAR", label: "Ano" },
];

type Aba = "PERFORMANCE" | "MEDIDAS" | "FOTOS" | "METAS";

export default function Progresso() {
  const [aba, setAba] = useState<Aba>("PERFORMANCE");
  const [range, setRange] = useState<ProgressRange>("M3");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Progresso</h1>
        <Link to="/academia/historico" className={cn("flex items-center gap-1.5 text-sm font-semibold", GYM.text)}>
          <History className="h-4 w-4" />
          Histórico
        </Link>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(
          [
            ["PERFORMANCE", "Performance"],
            ["MEDIDAS", "Medidas"],
            ["FOTOS", "Fotos"],
            ["METAS", "Metas"],
          ] as [Aba, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setAba(value)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              aba === value ? cn("text-neutral-900", GYM.solid) : "surface-2 text-muted hover:brightness-95",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "PERFORMANCE" && <Performance range={range} setRange={setRange} />}
      {aba === "MEDIDAS" && <Medidas />}
      {aba === "FOTOS" && <Fotos />}
      {aba === "METAS" && <Metas />}
    </div>
  );
}

function Performance({ range, setRange }: { range: ProgressRange; setRange: (r: ProgressRange) => void }) {
  const { data, isLoading } = useGymProgress(range);
  const { data: recordes } = useGymRecords();
  const hidden = usePrivacyStore((s) => s.hidden);

  if (isLoading || !data) return <Skeleton className="h-96 rounded-3xl" />;

  const t = data.totals;
  const semDados = data.volumeSeries.every((p) => p.value === 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              range === r.value ? cn("surface-2", GYM.text) : "text-muted hover:surface-2",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Treinos" value={String(t.sessions)} />
        <Stat label="Volume total" value={formatVolume(t.volume, hidden)} />
        <Stat label="Tempo treinado" value={formatMinutes(t.minutes * 60)} />
        <Stat label="Média por treino" value={t.averageMinutes === null ? "—" : `${t.averageMinutes} min`} />
        <Stat label="Descanso médio" value={t.averageRestSeconds === null ? "—" : `${t.averageRestSeconds}s`} />
        <Stat label="Consistência" value={t.consistencyPercent === null ? "—" : `${t.consistencyPercent}%`} />
      </div>

      {semDados ? (
        <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] py-10 text-center text-sm text-muted">
          Nenhum treino nesse período. Os gráficos aparecem a partir do primeiro.
        </p>
      ) : (
        <>
          <Grafico titulo="Volume por semana">
            <BarChart data={data.volumeSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })}
                formatter={(v: number) => [formatVolume(v, hidden), "Volume"]}
              />
              <Bar dataKey="value" fill={GYM.hex} radius={[6, 6, 0, 0]} />
            </BarChart>
          </Grafico>

          <Grafico titulo="Treinos por semana">
            <BarChart data={data.frequencySeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })}
                formatter={(v: number) => [String(v), "Treinos"]}
              />
              <Bar dataKey="value" fill={GYM.hexDim} radius={[6, 6, 0, 0]} />
            </BarChart>
          </Grafico>

          {data.bodyWeightSeries.length > 1 && (
            <Grafico titulo="Peso corporal">
              <LineChart data={data.bodyWeightSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                  labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short", year: "numeric" })}
                  formatter={(v: number) => [`${v} kg`, "Peso"]}
                />
                <Line type="monotone" dataKey="value" stroke={GYM.hex} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </Grafico>
          )}
        </>
      )}

      {recordes && recordes.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Trophy className="h-3.5 w-3.5" />
              Recordes ({t.records})
            </p>
            <ul className="mt-2 divide-y divide-[rgb(var(--border))]">
              {recordes.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.exerciseName}</p>
                    <p className="text-xs text-muted">
                      {RECORD_LABEL[r.kind]} · {formatDate(r.achievedAt!)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {r.weight} kg × {r.reps}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-black">{value}</p>
    </div>
  );
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{titulo}</p>
        <ResponsiveContainer width="100%" height={200}>
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
