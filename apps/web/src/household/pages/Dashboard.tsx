import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Receipt,
  CreditCard,
  PiggyBank,
  CheckCircle2,
  Clock,
  Landmark,
  AlertTriangle,
  ListChecks,
  PartyPopper,
  Globe,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useHouseholdDashboard } from "../api";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { ProgressRing } from "../components/ProgressRing";
import { IncomeVsExpensesChart } from "../components/IncomeVsExpensesChart";
import { PaymentEvolutionChart } from "../components/PaymentEvolutionChart";
import { CategoryChart } from "@/components/charts/CategoryChart";

export default function HouseholdDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: summary, isLoading } = useHouseholdDashboard(year, month);

  if (isLoading || !summary) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const freeBalanceTone = summary.freeBalance >= 0 ? "success" : "danger";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">Quanto entrou, quanto falta pagar, quanto está livre.</p>
        </div>
        <MonthSwitcher year={year} month={month} onChange={(y, m) => (setYear(y), setMonth(m))} />
      </div>

      {summary.allPaid && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <PartyPopper className="h-4 w-4 shrink-0" />
          Mês 100% pago! Mas um mês com tudo pago, puxe a cadeira e descanse um pouco.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total de entradas" value={formatCurrency(summary.totalIncome)} icon={<Wallet className="h-4 w-4" />} />
        <StatTile
          label="Total das contas"
          value={formatCurrency(summary.totalBills)}
          icon={<Receipt className="h-4 w-4" />}
          delay={0.05}
        />
        <StatTile
          label="Total dos cartões"
          value={formatCurrency(summary.totalCards)}
          icon={<CreditCard className="h-4 w-4" />}
          delay={0.1}
        />
        <StatTile
          label="Saldo livre"
          value={formatCurrency(summary.freeBalance)}
          icon={<PiggyBank className="h-4 w-4" />}
          tone={freeBalanceTone}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Já reservado" value={formatCurrency(summary.totalReserved)} icon={<PiggyBank className="h-4 w-4" />} />
        <StatTile
          label="Já pago"
          value={formatCurrency(summary.totalPaid)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          delay={0.05}
        />
        <StatTile
          label="Ainda pendente"
          value={formatCurrency(summary.totalPending)}
          icon={<Clock className="h-4 w-4" />}
          tone={summary.totalPending > 0 ? "danger" : "default"}
          delay={0.1}
        />
        <StatTile
          label="Total comprometido"
          value={formatCurrency(summary.totalCommitted)}
          icon={<Landmark className="h-4 w-4" />}
          delay={0.15}
          sublabel={
            summary.previousMonthComparison.deltaCommittedPct !== null
              ? `${summary.previousMonthComparison.deltaCommittedPct >= 0 ? "+" : ""}${summary.previousMonthComparison.deltaCommittedPct}% vs mês passado`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total obrigatório" value={formatCurrency(summary.totalMandatory)} icon={<Landmark className="h-4 w-4" />} />
        <StatTile label="Total opcional" value={formatCurrency(summary.totalOptional)} icon={<ListChecks className="h-4 w-4" />} delay={0.05} />
        <StatTile
          label="Contas pendentes"
          value={String(summary.billsPendingCount)}
          icon={<Clock className="h-4 w-4" />}
          delay={0.1}
        />
        <StatTile
          label="Contas"
          value={`${summary.billsPaidCount}/${summary.billsCount} pagas`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Taxa de poupança"
          value={summary.savingsRate !== null ? `${summary.savingsRate}%` : "—"}
          icon={summary.savingsRate !== null && summary.savingsRate >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          tone={summary.savingsRate !== null && summary.savingsRate < 0 ? "danger" : "default"}
          sublabel="Do que sobra da renda, sem comprometer"
        />
        {summary.foreignIncome.count > 0 && (
          <StatTile
            label="Dinheiro Gringo"
            value={formatCurrency(summary.foreignIncome.totalConvertedBrl)}
            icon={<Globe className="h-4 w-4" />}
            delay={0.05}
            sublabel={`US$ ${summary.foreignIncome.totalGrossUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · cotação média ${summary.foreignIncome.avgRate?.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}`}
          />
        )}
      </div>

      {summary.lateBills.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {summary.lateBills.length} conta(s) atrasada(s)
          </div>
          {summary.lateBills.map((b) => (
            <Link
              key={b.id}
              to="/casa/contas"
              className="flex items-center justify-between rounded-lg px-2 py-1 text-xs hover:bg-red-500/10"
            >
              <span>{b.name}</span>
              <span>
                Venceu em {formatDate(b.dueDate)} · {formatCurrency(b.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {summary.upcomingDue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {summary.upcomingDue.map((b) => (
              <Link
                key={b.id}
                to="/casa/contas"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:surface-2"
              >
                <span>{b.name}</span>
                <span className="text-muted">
                  {formatDate(b.dueDate)} · <span className="font-medium text-[rgb(var(--text))]">{formatCurrency(b.amount)}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entradas x Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeVsExpensesChart income={summary.incomeVsExpenses.income} expenses={summary.incomeVsExpenses.expenses} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.billsByCategory.length > 0 ? (
              <CategoryChart data={summary.billsByCategory.map((c) => ({ name: c.name, color: c.color, total: c.amount }))} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Nenhuma conta neste mês ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução do pagamento no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentEvolutionChart data={summary.paymentEvolution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Percentuais do mês</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-[rgb(var(--border))]">
            <ProgressRing pct={summary.paidPct} label="Contas pagas" color="#10B981" />
            <ProgressRing pct={summary.reservedPct} label="Valor reservado" color="#F59E0B" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
