import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { AssetAnalysis, DividendEventDto } from "../../types";

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DividendRow({ event }: { event: DividendEventDto }) {
  return (
    <div className="flex items-center justify-between rounded-xl surface-2 px-4 py-2.5">
      <div>
        <p className="text-sm font-medium">{event.paymentDate ? formatDate(event.paymentDate) : "Data a definir"}</p>
        <p className="text-xs text-muted">
          {event.type === "DIVIDENDO" ? "Dividendo" : event.type === "JCP" ? "JCP" : "Outro"}
          {event.relatedTo ? ` · ${event.relatedTo}` : ""}
        </p>
      </div>
      <p className="text-sm font-semibold">{formatCurrency(event.rate)}</p>
    </div>
  );
}

interface Props {
  analysis: AssetAnalysis | null | undefined;
  isLoading: boolean;
}

export function DividendsSection({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!analysis) {
    return <p className="py-6 text-center text-sm text-muted">Proventos indisponíveis pra esse ativo no momento.</p>;
  }

  const { dividendsByYear, dividendsPaid, dividendsUpcoming, dividendMonthRadar, payoutHistory } = analysis;
  const yearChartData = dividendsByYear.map((y) => ({ year: String(y.year), yieldPercent: y.yieldPercent ?? 0 }));
  const maxMonthlyCount = Math.max(1, ...dividendMonthRadar.map((m) => m.monthlyPaymentCount));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Dividend yield por ano</CardTitle>
        </CardHeader>
        <CardContent>
          {yearChartData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum provento registrado ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yearChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number) => [formatPercent(value), "DY"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                />
                <Bar dataKey="yieldPercent" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Radar de dividendo inteligente</CardTitle>
          <p className="text-xs text-muted">Meses em que esse ativo costuma pagar, com base no histórico.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {dividendMonthRadar.map((entry) => {
              const intensity = entry.monthlyPaymentCount / maxMonthlyCount;
              const active = entry.monthlyPaymentCount > 0;
              return (
                <div
                  key={entry.month}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[rgb(var(--border))] p-2 text-center"
                  style={active ? { backgroundColor: `rgba(245, 158, 11, ${0.12 + intensity * 0.35})` } : undefined}
                >
                  <span className="text-xs font-medium">{MONTH_ABBR[entry.month - 1]}</span>
                  <span className={`text-[10px] ${active ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>{entry.monthlyPaymentCount}x</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {payoutHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lucro líquido x Payout x DY, ano a ano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={payoutHistory.map((p) => ({ ...p, year: String(p.year) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="value"
                  tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                  width={80}
                />
                <YAxis
                  yAxisId="percent"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Lucro líquido") return [formatCurrency(value), name];
                    return [formatPercent(value), name];
                  }}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                />
                <Bar yAxisId="value" dataKey="netIncome" name="Lucro líquido" fill="#6D5BFF" radius={[4, 4, 0, 0]} />
                <Line yAxisId="percent" type="monotone" dataKey="payoutPercent" name="Payout" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="dividendYieldPercent"
                  name="DY"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#6D5BFF]" /> Lucro líquido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" /> Payout
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> DY
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pagos recentemente
              <Badge tone="neutral">{dividendsPaid.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dividendsPaid.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhum provento pago ainda.</p>
            ) : (
              dividendsPaid.map((event, i) => <DividendRow key={`${event.paymentDate}-${i}`} event={event} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              A pagar
              <Badge tone="accent">{dividendsUpcoming.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dividendsUpcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhum provento anunciado no momento.</p>
            ) : (
              dividendsUpcoming.map((event, i) => <DividendRow key={`${event.paymentDate}-${i}`} event={event} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
