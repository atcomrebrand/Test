import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  CreditCard,
  Home as HomeIcon,
  Landmark,
  LineChart,
  PiggyBank,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { SpendingEvolutionChart } from "@/components/charts/SpendingEvolutionChart";
import { formatCurrency, formatDate, formatPercent, maskAmountsInText } from "@/lib/format";
import { useHomeDashboard, HomeUpcomingEvent } from "@/features/useHomeDashboard";

const EVENT_SOURCE_LABEL: Record<HomeUpcomingEvent["source"], string> = {
  parcelamento: "Parcelas",
  casa: "Casa",
  financiamento: "Financiamento",
  investimentos: "Investimentos",
};

const EVENT_SOURCE_COLOR: Record<HomeUpcomingEvent["source"], string> = {
  parcelamento: "bg-accent-500/10 text-accent-500",
  casa: "bg-amber-500/10 text-amber-500",
  financiamento: "bg-rose-500/10 text-rose-500",
  investimentos: "bg-emerald-500/10 text-emerald-500",
};

export function HomeDashboardSection() {
  const { data, isLoading } = useHomeDashboard();

  if (isLoading || !data) {
    return (
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const { netWorth, monthly, percentages, modules, upcomingEvents, forecast, spendingEvolution } = data;

  return (
    <div className="mt-10 space-y-8">
      <div>
        <h2 className="text-lg font-bold">Visão geral</h2>
        <p className="mt-1 text-sm text-muted">Cruzando os dados de todos os módulos.</p>
      </div>

      {/* O número que resume tudo, em destaque e antes de qualquer outro: é a leitura que o resto
          da tela detalha. A composição vem junto porque o total sozinho não deixa reconhecer as
          parcelas — são os mesmos dois números do card de Investimentos e da Visão Geral de
          Financiamentos. */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="border-accent-500/20 bg-gradient-to-br from-accent-500/10 to-transparent">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-muted">
              <Wallet className="h-4 w-4" />
              <p className="text-sm font-medium">Patrimônio total</p>
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{formatCurrency(netWorth.netWorth)}</p>
            <p className="mt-2 text-sm text-muted">
              {formatCurrency(netWorth.investedAssets)} em investimentos
              {modules.financiamentos.totalActive > 0 && (
                <> + {formatCurrency(modules.financiamentos.equity.equity)} de patrimônio nos bens</>
              )}
            </p>
            {/* Sem esse aviso o número pareceria completo: o bem sem avaliação não entra nos ativos
                mas a dívida dele entra inteira, deixando o patrimônio artificialmente pessimista. */}
            {netWorth.assetsPendingValuation > 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                {netWorth.assetsPendingValuation} bem financiado
                {netWorth.assetsPendingValuation > 1 ? "s ainda sem valor informado" : " ainda sem valor informado"} — o
                total está subestimado.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Patrimônio"
          value={formatCurrency(modules.investimentos.patrimonioTotal)}
          sublabel="Investimentos"
          icon={<Wallet className="h-4 w-4" />}
          delay={0}
        />
        <StatTile
          label="Renda do mês"
          value={formatCurrency(monthly.income)}
          sublabel="Contas da Casa"
          icon={<PiggyBank className="h-4 w-4" />}
          delay={0.05}
        />
        <StatTile
          label="Comprometido no mês"
          value={formatCurrency(monthly.committed)}
          sublabel="Contas da Casa"
          icon={<CreditCard className="h-4 w-4" />}
          delay={0.1}
        />
        <StatTile
          label="Sobra no mês"
          value={formatCurrency(monthly.freeBalance)}
          tone={monthly.freeBalance >= 0 ? "success" : "danger"}
          sublabel={monthly.savingsRatePct !== null ? `${formatPercent(monthly.savingsRatePct)} da renda` : undefined}
          icon={<Sparkles className="h-4 w-4" />}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Limite de cartão usado" value={formatPercent(percentages.limitUsagePct)} delay={0.1} />
        <StatTile
          label="Rentabilidade Renda Fixa"
          value={formatPercent(percentages.fixedIncomeReturnPct)}
          sublabel="Sobre total investido"
          delay={0.15}
        />
        <StatTile
          label="Rentabilidade Variável"
          value={formatPercent(percentages.variableReturnPct)}
          sublabel="Sobre total investido"
          delay={0.2}
        />
        <StatTile
          label="Rentabilidade Investimentos"
          value={formatPercent(percentages.investmentReturnPct)}
          sublabel="Sobre total investido"
          delay={0.25}
        />
        <StatTile label="Crescimento de horas" value={formatPercent(percentages.hoursGrowthPct)} delay={0.3} />
        <StatTile label="Dívida de financiamento sobre patrimônio" value={formatPercent(netWorth.debtToAssetPct)} delay={0.35} />
      </div>

      {spendingEvolution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolução do comprometido (Parcelas)</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingEvolutionChart data={spendingEvolution} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Parcelas</p>
              <p className="text-xs text-muted">{modules.parcelamento.openInstallmentsCount} parcela(s) em aberto</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Restante</p>
              <p className="font-semibold">{formatCurrency(modules.parcelamento.totalRemaining)}</p>
            </div>
            <Link to="/parcelas" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <HomeIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Contas da Casa</p>
              <p className="text-xs text-muted">
                {modules.casa.billsPendingCount} pendente(s){modules.casa.billsLateCount > 0 ? `, ${modules.casa.billsLateCount} atrasada(s)` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Sobra</p>
              <p className="font-semibold">{formatCurrency(modules.casa.freeBalance)}</p>
            </div>
            <Link to="/casa" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <LineChart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Investimentos</p>
              <p className="text-xs text-muted">Aportes no mês: {formatCurrency(modules.investimentos.aportesDoMes)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Patrimônio</p>
              <p className="font-semibold">{formatCurrency(modules.investimentos.patrimonioTotal)}</p>
            </div>
            <Link to="/investimentos" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Horas</p>
              <p className="text-xs text-muted">{modules.horas.hoursThisMonth.toFixed(1)}h trabalhadas no mês</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Faturado</p>
              <p className="font-semibold">{formatCurrency(modules.horas.totalRevenue)}</p>
            </div>
            <Link to="/horas" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        {modules.financiamentos.totalActive > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                  <Landmark className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Financiamentos</p>
                  <p className="text-xs text-muted">{modules.financiamentos.totalActive} ativo(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Restante</p>
                  <p className="font-semibold">{formatCurrency(modules.financiamentos.totalRemaining)}</p>
                </div>
                <Link to="/financiamentos" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
                  Ver <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>O que vem por aí</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted">Nada previsto por enquanto.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event, idx) => (
                  <li key={idx} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                    <Badge tone="neutral" className={EVENT_SOURCE_COLOR[event.source]}>
                      {EVENT_SOURCE_LABEL[event.source]}
                    </Badge>
                    <span className="flex-1 truncate">{event.label}</span>
                    <span className="shrink-0 text-xs text-muted">{formatDate(event.date)}</span>
                    {event.amount !== null && <span className="shrink-0 font-medium">{formatCurrency(event.amount)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previsões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {forecast.insights.length === 0 && !forecast.nextMonth.householdCommitted && !forecast.nextMonth.householdIncome ? (
              <p className="text-sm text-muted">Ainda não há histórico suficiente pra prever os próximos meses.</p>
            ) : (
              <>
                {forecast.nextMonth.householdCommitted !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Contas da Casa (próximo mês)</span>
                    <span className="font-semibold">{formatCurrency(forecast.nextMonth.householdCommitted)}</span>
                  </div>
                )}
                {forecast.nextMonth.householdIncome !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Renda da Casa (próximo mês)</span>
                    <span className="font-semibold">{formatCurrency(forecast.nextMonth.householdIncome)}</span>
                  </div>
                )}
                {forecast.insights.length > 0 && (
                  <ul className="space-y-1.5 border-t border-[rgb(var(--border))] pt-3">
                    {forecast.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-muted">
                        {maskAmountsInText(insight)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {modules.horas.insights.length > 0 && (
              <div className="border-t border-[rgb(var(--border))] pt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Horas</p>
                <ul className="space-y-1.5">
                  {modules.horas.insights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-muted">
                      {maskAmountsInText(insight)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
