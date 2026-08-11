import { Link } from "react-router-dom";
import { Clock, Wallet, TrendingUp, TrendingDown, CalendarDays, Sparkles, Timer } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { formatCurrency, formatHours } from "@/lib/format";
import { useTrackingDashboard, useActiveSession } from "../api";
import { useLiveElapsed } from "../hooks/useLiveElapsed";
import { formatHMS } from "../lib/sessionTime";
import { HoursBarChart } from "../components/HoursBarChart";
import { PendingPaymentBanner } from "../components/PendingPaymentBanner";

const CATEGORY_COLORS: Record<string, string> = {
  FIXO: "#7C3AED",
  FREELA: "#F59E0B",
  OUTRO: "#3B82F6",
};


function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export default function Dashboard() {
  const { data, isLoading } = useTrackingDashboard();
  const { data: activeSession } = useActiveSession();
  const live = useLiveElapsed(activeSession);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const categoryData = data.revenueByCategory.map((c) => ({
    name: c.label,
    color: CATEGORY_COLORS[c.category] ?? "#9CA3AF",
    total: c.amount,
    key: c.category,
  }));

  const clientData = data.revenueByClient.map((c, i) => ({
    name: c.client,
    color: ["#7C3AED", "#F59E0B", "#3B82F6", "#10B981", "#EF4444"][i % 5],
    total: c.amount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Visão geral de horas, faturamento e produtividade.</p>
      </div>

      <PendingPaymentBanner />

      {activeSession && live && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              </span>
              <div>
                <p className="text-sm font-semibold">Trabalho em andamento — {activeSession.job.company}</p>
                <p className="font-mono text-lg font-bold tabular-nums">{formatHMS(live.netSeconds)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted">Valor acumulado</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(live.equivalentValue)}</p>
              </div>
              <Link to="/horas">
                <Button size="sm">
                  <Timer className="h-4 w-4" />
                  Abrir Modo Foco
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Horas hoje" value={formatHours(data.hoursToday)} icon={<Clock className="h-4 w-4" />} delay={0} />
        <StatTile label="Horas no mês" value={formatHours(data.hoursThisMonth)} icon={<Clock className="h-4 w-4" />} delay={0.03} />
        <StatTile label="Receita trabalhos fixos" value={formatCurrency(data.fixedJobsRevenue)} icon={<Wallet className="h-4 w-4" />} delay={0.06} />
        <StatTile label="Receita projetos extras" value={formatCurrency(data.freelanceRevenue)} icon={<Wallet className="h-4 w-4" />} delay={0.09} />
        <StatTile label="Outras entradas" value={formatCurrency(data.otherIncome)} icon={<Wallet className="h-4 w-4" />} delay={0.12} />
        <StatTile label="Receita total" value={formatCurrency(data.totalRevenue)} icon={<Wallet className="h-4 w-4" />} tone="success" delay={0.15} />
        <StatTile
          label="Valor médio/hora"
          value={data.averageHourlyRate !== null ? formatCurrency(data.averageHourlyRate) : "—"}
          icon={<Sparkles className="h-4 w-4" />}
          delay={0.18}
        />
        <StatTile
          label="Média diária de horas"
          value={data.averageDailyHours !== null ? formatHours(data.averageDailyHours) : "—"}
          icon={<Clock className="h-4 w-4" />}
          delay={0.21}
        />
        <StatTile label="Dias trabalhados" value={String(data.daysWorked)} icon={<CalendarDays className="h-4 w-4" />} delay={0.24} />
        <StatTile
          label="Dias sem trabalhar"
          value={String(data.daysWithoutWork)}
          icon={<CalendarDays className="h-4 w-4" />}
          tone={data.daysWithoutWork > 5 ? "danger" : "default"}
          delay={0.27}
        />
        <StatTile
          label="Próximo pagamento"
          value={data.nextPayment ? new Date(data.nextPayment.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
          sublabel={data.nextPayment ? `${data.nextPayment.jobName} — ${data.nextPayment.company}` : "Nenhum trabalho com dia de pagamento definido"}
          icon={<CalendarDays className="h-4 w-4" />}
          delay={0.3}
        />
        <StatTile
          label="Crescimento financeiro"
          value={formatPercent(data.financialGrowthPercent)}
          sublabel="vs. mês anterior"
          icon={data.financialGrowthPercent !== null && data.financialGrowthPercent < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          tone={data.financialGrowthPercent !== null && data.financialGrowthPercent < 0 ? "danger" : "success"}
          delay={0.33}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Horas por dia (últimos 14 dias)</p>
            <HoursBarChart data={data.hoursByDay} />
          </CardContent>
        </Card>

        {categoryData.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="font-semibold">Receita por categoria</p>
              <CategoryChart data={categoryData} />
            </CardContent>
          </Card>
        )}
      </div>

      {clientData.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Receita por cliente (este mês)</p>
            <CategoryChart data={clientData} />
          </CardContent>
        </Card>
      )}

      {data.insights.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Insights automáticos
            </p>
            <ul className="flex flex-col gap-2">
              {data.insights.map((insight, i) => (
                <li key={i} className="rounded-xl surface-2 px-3 py-2 text-sm">
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
