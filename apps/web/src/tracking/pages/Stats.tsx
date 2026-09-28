import { Card, CardContent } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatHours } from "@/lib/format";
import { useTrackingStats } from "../api";
import { PlacementChart } from "../components/PlacementChart";


function formatHourOfDay(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function RankingList({ items, unit }: { items: { name: string; amount: number }[]; unit: "currency" | "count" }) {
  if (items.length === 0) return <p className="text-sm text-muted">Sem dados suficientes ainda.</p>;
  const max = Math.max(...items.map((i) => i.amount));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{item.name}</span>
            <span className="font-semibold">{unit === "currency" ? formatCurrency(item.amount) : item.amount}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full surface-2">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${max > 0 ? (item.amount / max) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductivityBars({ items }: { items: { period: string; hours: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Sem dados suficientes ainda.</p>;
  const max = Math.max(...items.map((i) => i.hours));
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-2">
      {items.map((item, i) => (
        <div key={i} className="flex min-w-[36px] flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end">
            <div className="w-full rounded-t bg-violet-500" style={{ height: `${max > 0 ? (item.hours / max) * 100 : 0}%` }} />
          </div>
          <span className="text-[10px] text-muted">{item.period.length > 7 ? item.period.slice(5) : formatMonthLabel(item.period)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const { data, isLoading } = useTrackingStats();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Estatísticas</h1>
        <p className="text-sm text-muted">Recordes e médias desde que você começou a usar o Horas.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total de horas" value={formatHours(data.totalHoursAllTime)} />
        <StatTile label="Total faturado" value={formatCurrency(data.totalRevenueAllTime)} tone="success" />
        <StatTile label="Valor médio/hora" value={data.averageHourlyRateAllTime !== null ? formatCurrency(data.averageHourlyRateAllTime) : "—"} />
        <StatTile label="Check-ins" value={String(data.checkInsCount)} />
        <StatTile label="Tempo médio diário" value={data.averageDailyHours !== null ? formatHours(data.averageDailyHours) : "—"} />
        <StatTile label="Dias consecutivos" value={String(data.longestStreak)} />
        <StatTile label="Horário médio de início" value={data.averageStartHour !== null ? formatHourOfDay(data.averageStartHour) : "—"} />
        <StatTile label="Horário médio de término" value={data.averageEndHour !== null ? formatHourOfDay(data.averageEndHour) : "—"} />
      </div>

      {/* Só aparece pra quem tem serviço com colocação — o próprio componente se esconde quando não
          há nenhum dia registrado, em vez de deixar uma seção vazia numa tela já longa. */}
      <PlacementChart />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted">Melhor mês</p>
            <p className="text-lg font-bold">{data.bestMonth ? formatCurrency(data.bestMonth.amount) : "—"}</p>
            <p className="text-xs text-muted">{data.bestMonth ? formatMonthLabel(data.bestMonth.month) : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted">Menor mês</p>
            <p className="text-lg font-bold">{data.worstMonth ? formatCurrency(data.worstMonth.amount) : "—"}</p>
            <p className="text-xs text-muted">{data.worstMonth ? formatMonthLabel(data.worstMonth.month) : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted">Maior projeto</p>
            <p className="text-lg font-bold">{data.biggestProject ? formatCurrency(data.biggestProject.amount) : "—"}</p>
            <p className="text-xs text-muted">{data.biggestProject?.name ?? ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted">Maior renda extra</p>
            <p className="text-lg font-bold">{data.biggestOtherIncome ? formatCurrency(data.biggestOtherIncome.amount) : "—"}</p>
            <p className="text-xs text-muted">{data.biggestOtherIncome?.name ?? ""}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Ranking de clientes</p>
            <RankingList items={data.clientRanking} unit="currency" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Ranking de empresas</p>
            <RankingList items={data.companyRanking} unit="currency" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Ranking de projetos</p>
            <RankingList items={data.projectRanking} unit="currency" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Produtividade semanal</p>
            <ProductivityBars items={data.productivityByWeek} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="font-semibold">Produtividade mensal</p>
            <ProductivityBars items={data.productivityByMonth} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
