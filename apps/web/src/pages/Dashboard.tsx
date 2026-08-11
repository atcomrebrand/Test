import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Wallet, CalendarClock, ListChecks, TrendingUp, ReceiptText, AlertTriangle, Landmark, ArrowRight, SlidersHorizontal, Repeat, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpendingEvolutionChart } from "@/components/charts/SpendingEvolutionChart";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { useDashboardSummary, useSpendingByCategory, useSpendingEvolution } from "@/features/useDashboard";
import { useFinancingSummary } from "@/features/useFinancings";
import { usePurchases } from "@/features/usePurchases";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";

export default function Dashboard() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: evolution } = useSpendingEvolution();
  const { data: byCategory } = useSpendingByCategory();
  const { data: financingSummary } = useFinancingSummary();
  const { data: subscriptionsData } = usePurchases({ kind: "RECURRING", pageSize: 100 });

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["financings"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      ]);
      toast.success("Dashboard atualizado!");
    } finally {
      setRefreshing(false);
    }
  }

  const activeSubscriptions = (subscriptionsData?.items ?? []).filter(
    (p) => !(p.recurrenceEndDate && new Date(p.recurrenceEndDate) <= new Date()),
  );
  const subscriptionsMonthlyTotal = activeSubscriptions
    .filter((p) => (p.billingCycle ?? "MONTHLY") === "MONTHLY")
    .reduce((acc, p) => acc + Number(p.totalAmount), 0);
  const nextRenewal = activeSubscriptions
    .flatMap((p) => {
      const installment = p.installments?.find((i) => i.status === "PENDING");
      return installment ? [{ purchase: p, installment }] : [];
    })
    .sort((a, b) => new Date(a.installment.dueDate).getTime() - new Date(b.installment.dueDate).getTime())[0];

  if (isLoading || !summary) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Sua visão geral financeira, em tempo real." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const usagePct = summary.limitUsage.usagePct;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Sua visão geral financeira, em tempo real."
        actions={
          <Button variant="outline" onClick={onRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <OnboardingChecklist hasCards={Boolean(summary.nextClosing)} hasPurchases={summary.recentPurchases.length > 0} />

      <div className="mb-3 flex items-center justify-end">
        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-[rgb(var(--text))]"
          title="Mudar em Configurações"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {summary.includeFinancingInTotals ? "Totais incluem financiamentos" : "Totais não incluem financiamentos"}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Comprometido este mês"
          value={formatCurrency(summary.committedThisMonth)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatTile
          label="Comprometido próximo mês"
          value={formatCurrency(summary.committedNextMonth)}
          icon={<TrendingUp className="h-4 w-4" />}
          delay={0.05}
        />
        <StatTile
          label="Total restante em parcelas"
          value={formatCurrency(summary.totalRemaining)}
          icon={<ReceiptText className="h-4 w-4" />}
          delay={0.1}
        />
        <StatTile
          label="Parcelas em aberto"
          value={String(summary.openInstallmentsCount)}
          icon={<ListChecks className="h-4 w-4" />}
          delay={0.15}
        />
      </div>

      {summary.financing.lateCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Você possui {summary.financing.lateCount} parcela(s) de financiamento atrasada(s).
        </div>
      )}

      {financingSummary && financingSummary.totalActive > 0 && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center gap-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                <Landmark className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Financiamentos</p>
                <p className="text-xs text-muted">{financingSummary.totalActive} ativo(s)</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Comprometido este mês</p>
              <p className="font-semibold">{formatCurrency(financingSummary.committedThisMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Restante a pagar</p>
              <p className="font-semibold">{formatCurrency(financingSummary.totalRemaining)}</p>
            </div>
            {financingSummary.nextInstallment && (
              <div>
                <p className="text-xs text-muted">Próxima parcela</p>
                <p className="font-semibold">
                  {formatCurrency(financingSummary.nextInstallment.amount)} em{" "}
                  {formatDate(financingSummary.nextInstallment.dueDate)}
                </p>
              </div>
            )}
            <Link to="/financiamentos" className="ml-auto flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver financiamentos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {activeSubscriptions.length > 0 && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center gap-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                <Repeat className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Assinaturas</p>
                <p className="text-xs text-muted">{activeSubscriptions.length} ativa(s)</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Total mensal</p>
              <p className="font-semibold">{formatCurrency(subscriptionsMonthlyTotal)}</p>
            </div>
            {nextRenewal && (
              <div>
                <p className="text-xs text-muted">Próxima renovação</p>
                <p className="font-semibold">
                  {nextRenewal.purchase.name} em {formatDate(nextRenewal.installment.dueDate)}
                </p>
              </div>
            )}
            <Link to="/subscriptions" className="ml-auto flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver assinaturas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução dos gastos</CardTitle>
          </CardHeader>
          <CardContent>{evolution && <SpendingEvolutionChart data={evolution} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limite utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-2">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90">
                  <circle cx="64" cy="64" r="54" strokeWidth="12" className="stroke-[rgb(var(--surface-2))]" fill="none" />
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    stroke={usagePct >= 85 ? "#EF4444" : usagePct >= 60 ? "#F59E0B" : "#6D5BFF"}
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - usagePct / 100)}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <span className="absolute text-xl font-bold">{usagePct.toFixed(0)}%</span>
              </div>
              <div className="mt-4 w-full space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Usado</span>
                  <span className="font-medium">{formatCurrency(summary.limitUsage.totalSpent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Limite total</span>
                  <span className="font-medium">{formatCurrency(summary.limitUsage.totalLimit)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gastos por categoria (mês atual)</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory && byCategory.length > 0 ? (
              <CategoryChart data={byCategory} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Nenhum gasto neste mês ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.nextClosing && (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Próximo fechamento</p>
                  <p className="text-xs text-muted">
                    {summary.nextClosing.cardName} — {formatDate(summary.nextClosing.date)}
                  </p>
                </div>
              </div>
            )}
            {summary.nextDue && (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Próximo vencimento</p>
                  <p className="text-xs text-muted">
                    {summary.nextDue.cardName} — {formatDate(summary.nextDue.date)}
                    {daysUntil(summary.nextDue.date) <= 3 && (
                      <Badge tone="warning" className="ml-2">
                        {daysUntil(summary.nextDue.date)}d
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            )}
            <div className="border-t border-[rgb(var(--border))] pt-3">
              <p className="text-sm font-medium">Valor estimado da próxima fatura</p>
              <p className="text-lg font-bold text-accent-500">{formatCurrency(summary.estimatedNextInvoice)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Compras recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recentPurchases.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="h-6 w-6" />}
              title="Nenhuma compra registrada"
              description="Lance sua primeira compra para começar a ver seus dados aqui."
            />
          ) : (
            <div className="divide-y divide-[rgb(var(--border))]">
              {summary.recentPurchases.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.category?.color ?? "#999" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.card.name} · {formatDate(p.purchaseDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(p.totalAmount)}</p>
                    <p className="text-xs text-muted">
                      {p.kind === "CASH" ? "À vista" : `${p.installmentsCount}x`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
