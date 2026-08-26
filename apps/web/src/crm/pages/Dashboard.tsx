import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Battery,
  ArrowRight,
  CalendarClock,
  Info,
  Store,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { useCrmDashboard } from "../api";
import { DueRow } from "../components/DueRow";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "month", label: "Este mês" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
];

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold",
          tone === "good" && "text-emerald-500",
          tone === "warn" && "text-amber-500",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useCrmDashboard(period);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const { customers, dueBoard, resellers, churn, alerts, byCurrency, panel } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Quem precisa de atenção agora, e quanto o mês está gerando." />

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                a.tone === "danger" && "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400",
                a.tone === "warning" && "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
                a.tone === "info" && "border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400",
              )}
            >
              {a.tone === "info" ? (
                <Info className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {a.message}
            </motion.div>
          ))}
        </div>
      )}

      {/* Um bloco por moeda: real e dólar nunca entram no mesmo total, porque um número que junta
          grandezas diferentes parece preciso e não significa nada. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Receita do período</h2>
        <Select options={PERIODS} value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byCurrency.map((b) => (
          <Card key={b.currency}>
            <CardContent className="py-5">
              <div className="mb-3 flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(b.total, b.currency)}</p>
                <span className="surface-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium">{b.currency}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/5 p-3">
                  <p className="text-xs text-muted">Clientes diretos</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(b.direct, b.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-violet-500/5 p-3">
                  <p className="text-xs text-muted">Revendedores</p>
                  <p className="mt-0.5 text-lg font-bold text-violet-600 dark:text-violet-400">
                    {formatCurrency(b.reseller, b.currency)}
                  </p>
                </div>
              </div>

              {/* Lucro depois da taxa E do que os créditos custaram — sem o custo, "receita"
                  parece lucro, quando cada renovação já saiu com um custo embutido. */}
              <div className="surface-2 mt-3 flex flex-col gap-1 rounded-xl p-3 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Taxas</span>
                  <span>−{formatCurrency(b.fees, b.currency)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>{b.creditsConsumed} crédito(s) consumido(s)</span>
                  <span>−{formatCurrency(b.creditCost, b.currency)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[rgb(var(--border))] pt-2 font-semibold">
                  <span>Lucro</span>
                  <span className={b.profit >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {formatCurrency(b.profit, b.currency)}
                  </span>
                </div>
                {b.costUnknown && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Sem preço de compra registrado — o custo dos créditos ficou de fora e o lucro está otimista.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Saldo do painel é o recurso que limita tudo: sem crédito a renovação é bloqueada. */}
      {panel.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {panel.map((p) => (
            <Link key={p.portfolio.id} to="/crm/painel">
              <div
                className={cn(
                  "surface rounded-xl border p-3 transition-colors hover:surface-2",
                  p.lowCredit ? "border-amber-500/40" : "border-[rgb(var(--border))]",
                )}
              >
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Battery className="h-3 w-3" /> Painel · {p.portfolio.name}
                </p>
                <p className={cn("mt-0.5 text-xl font-bold", p.balance <= 0 && "text-red-500")}>{p.balance}</p>
                <p className="text-[11px] text-muted">créditos</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-indigo-500" /> Clientes
          </h2>
          <Link to="/crm/clientes" className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Total" value={customers.total} />
          <Metric label="Ativos" value={customers.active} tone="good" />
          <Metric label="Vencem hoje" value={customers.dueToday} tone={customers.dueToday > 0 ? "warn" : undefined} />
          <Metric label="Em atraso" value={customers.late} tone={customers.late > 0 ? "warn" : undefined} />
          <Metric
            label="Inadimplentes"
            value={customers.delinquent}
            tone={customers.delinquent > 0 ? "bad" : undefined}
          />
          <Metric label="Novos no mês" value={customers.newThisMonth} />
          <Metric label="Em teste" value={customers.trial} />
          <Metric label="Vencem em 7d" value={customers.dueIn7Days} />
          <Metric label="Vencem em 30d" value={customers.dueIn30Days} />
          <Metric label="Cancelados" value={customers.cancelled} />
          <Metric label="Recuperação" value={customers.recovered} />
          <Metric
            label="Crescimento"
            value={`${churn.netGrowth >= 0 ? "+" : ""}${churn.netGrowth}`}
            sub={churn.churnRate !== null ? `churn ${churn.churnRate}%` : "sem base ainda"}
            tone={churn.netGrowth >= 0 ? "good" : "bad"}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-indigo-500" /> Vencimentos
          </h2>
          <Link
            to="/crm/vencimentos"
            className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline"
          >
            Abrir painel <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {dueBoard.today.customers.length === 0 && dueBoard.late.customers.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted">
              Ninguém vencendo hoje nem em atraso. 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {dueBoard.late.customers.slice(0, 3).map((c) => (
              <DueRow key={c.id} customer={c} tone="late" />
            ))}
            {dueBoard.today.customers.slice(0, 3).map((c) => (
              <DueRow key={c.id} customer={c} tone="today" />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Store className="h-4 w-4 text-violet-500" /> Revendedores
          </h2>
          <Link
            to="/crm/revendedores"
            className="flex items-center gap-1 text-xs font-medium text-violet-500 hover:underline"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Vínculos" value={resellers.total} />
          <Metric label="Ativos" value={resellers.active} tone="good" />
          <Metric label="Atenção" value={resellers.attention} tone={resellers.attention > 0 ? "warn" : undefined} />
          <Metric label="Parados" value={resellers.inactive} tone={resellers.inactive > 0 ? "bad" : undefined} />
          <Metric label="Saldo baixo" value={resellers.lowCredit} tone={resellers.lowCredit > 0 ? "warn" : undefined} />
          <Metric label="Créditos disponíveis" value={resellers.creditsAvailable} />
          <Metric label="Créditos vendidos" value={resellers.creditsSold} />
          <Metric label="Créditos usados" value={resellers.creditsUsed} />
          <Metric label="Recargas" value={resellers.totalRecharges} />
          <Metric label="Receita de recargas" value={formatCurrency(resellers.rechargeRevenue)} />
          <Metric
            label="Ticket médio"
            value={resellers.averageRechargeTicket !== null ? formatCurrency(resellers.averageRechargeTicket) : "—"}
          />
          {/* Rotulado como estimativa em todo lugar (§37, §44): é número informado à mão, não
              contagem de clientes cadastrados no CRM. */}
          <Metric
            label="Clientes de revenda"
            value={`~${resellers.approxActiveClients}`}
            sub="estimativa informada"
          />
        </div>
      </section>

      {resellers.ranking.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-violet-500" /> Ranking de revendedores
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-1 py-2">
              {resellers.ranking.slice(0, 5).map((r, i) => (
                <Link
                  key={r.linkId}
                  to={`/crm/revendedores/${r.resellerId}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:surface-2"
                >
                  <span className="w-5 text-sm font-bold text-muted">{i + 1}º</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.resellerName}</p>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.portfolioColor }} />
                      {r.portfolioName} · {r.balance} créditos
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(r.totalSpent)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
