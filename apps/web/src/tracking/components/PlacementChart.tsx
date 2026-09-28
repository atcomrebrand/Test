import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { usePlacementEvolution } from "../api";
import { PlacementJob, PlacementMetricSummary } from "../types";

type Metric = "placement" | "satisfactionPercent" | "responseMinutes";

/**
 * As três métricas e, junto com cada uma, a **direção** em que ela melhora.
 *
 * Isso não é enfeite: em colocação e tempo de resposta menor é melhor, e um gráfico que ignora isso
 * desenha a maior evolução possível (de 12º pra 1º) como uma linha despencando. O eixo dessas duas
 * é invertido, então "pra cima" é sempre "melhorou", nas três.
 */
const METRICS: Record<Metric, { label: string; short: string; lowerIsBetter: boolean; format: (v: number) => string; summaryKey: keyof PlacementJob["summary"] }> = {
  placement: {
    label: "Colocação",
    short: "Colocação",
    lowerIsBetter: true,
    format: (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}º`,
    summaryKey: "placement",
  },
  satisfactionPercent: {
    label: "Satisfação dos clientes",
    short: "Satisfação",
    lowerIsBetter: false,
    format: (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
    summaryKey: "satisfaction",
  },
  responseMinutes: {
    label: "Tempo de resposta",
    short: "Resposta",
    lowerIsBetter: true,
    format: (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`,
    summaryKey: "responseMinutes",
  },
};

export function PlacementChart() {
  const { data, isLoading } = usePlacementEvolution();
  const [metric, setMetric] = useState<Metric>("placement");

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
  // Sem nenhum dado o cartão não aparece: quem não tem serviço com colocação não deve ganhar uma
  // seção vazia numa tela que já é longa.
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-violet-500" />
            Colocação
          </h2>
          <div className="flex rounded-lg surface-2 p-0.5">
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                aria-pressed={metric === key}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  metric === key ? "surface shadow-sm" : "text-muted hover:text-[rgb(var(--text))]",
                )}
              >
                {METRICS[key].short}
              </button>
            ))}
          </div>
        </div>

        {/* Um cartão por trabalho, nunca uma linha só: ser 3º entre dez não é o mesmo que ser 3º
            entre duzentos, então juntar serviços diferentes na mesma escala não significaria nada. */}
        {data.map((job) => (
          <JobChart key={job.jobId} job={job} metric={metric} />
        ))}
      </CardContent>
    </Card>
  );
}

function JobChart({ job, metric }: { job: PlacementJob; metric: Metric }) {
  const m = METRICS[metric];
  const summary = job.summary[m.summaryKey] as PlacementMetricSummary | null;
  const pontos = job.points.filter((p) => p[metric] !== null).map((p) => ({ date: p.date, valor: p[metric] as number }));

  if (pontos.length === 0) {
    return (
      <div className="rounded-xl surface-2 p-4">
        <p className="text-sm font-semibold">{job.jobName}</p>
        <p className="text-xs text-muted">Nenhum dia com {m.label.toLowerCase()} registrada.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">{job.jobName}</p>
        {summary && (
          <p className="flex items-center gap-3 text-xs text-muted">
            <span>
              Melhor <span className="font-semibold text-[rgb(var(--text))]">{m.format(summary.best)}</span>
            </span>
            <span>
              Média <span className="font-semibold text-[rgb(var(--text))]">{m.format(summary.average)}</span>
            </span>
            {/* A tendência já vem com o sinal certo do backend — positivo é sempre "melhorou",
                mesmo quando o número da métrica caiu. */}
            {summary.trend !== null && summary.trend !== 0 && (
              <span className={cn("font-semibold", summary.trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                {summary.trend > 0 ? "melhorou" : "piorou"}
              </span>
            )}
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={pontos} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
            tickFormatter={(d: string) => formatDate(d, { day: "2-digit", month: "2-digit" })}
            tickLine={false}
            axisLine={false}
          />
          {/* Eixo invertido nas métricas em que menor é melhor: com ele normal, subir no ranking
              desenharia uma queda, que é a leitura oposta da verdade. */}
          <YAxis
            reversed={m.lowerIsBetter}
            tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
            tickFormatter={(v: number) => m.format(v)}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
            labelFormatter={(d: string) => formatDate(d, { day: "2-digit", month: "short", year: "numeric" })}
            formatter={(v: number) => [m.format(v), m.label]}
          />
          <Line type="monotone" dataKey="valor" stroke={job.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
