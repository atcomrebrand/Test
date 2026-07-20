import { useMemo, useState } from "react";
import { Plus, Repeat, Ban, CalendarClock, RefreshCw, RefreshCwOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PurchaseIcon } from "@/components/PurchaseIcon";
import { SubscriptionFormModal } from "@/components/SubscriptionFormModal";
import { ScheduleCancellationModal } from "@/components/ScheduleCancellationModal";
import { AutoRenewChart } from "@/components/charts/AutoRenewChart";
import { usePurchases, useCancelRecurrence } from "@/features/usePurchases";
import { formatCurrency, formatDate } from "@/lib/format";
import { Purchase } from "@/types";

export default function Subscriptions() {
  const { data, isLoading } = usePurchases({ kind: "RECURRING", pageSize: 100 });
  const cancelRecurrence = useCancelRecurrence();

  const [formOpen, setFormOpen] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState<string | null>(null);

  const subscriptions = data?.items ?? [];
  const scheduleTarget = subscriptions.find((s) => s.id === scheduleTargetId) ?? null;

  const isCancelled = (p: Purchase) => Boolean(p.recurrenceEndDate && new Date(p.recurrenceEndDate) <= new Date());
  const isScheduled = (p: Purchase) => Boolean(p.recurrenceEndDate && new Date(p.recurrenceEndDate) > new Date());

  const active = subscriptions.filter((p) => !isCancelled(p));

  const autoRenewChartData = useMemo(() => {
    const on = active.filter((p) => p.autoRenew !== false).length;
    const off = active.filter((p) => p.autoRenew === false).length;
    return [
      { name: "Renovação automática", color: "#22C55E", total: on },
      { name: "Renovação manual", color: "#F59E0B", total: off },
    ].filter((d) => d.total > 0);
  }, [active]);

  const monthlyTotal = active
    .filter((p) => (p.billingCycle ?? "MONTHLY") === "MONTHLY")
    .reduce((acc, p) => acc + Number(p.totalAmount), 0);
  const annualTotal = active
    .filter((p) => p.billingCycle === "ANNUAL")
    .reduce((acc, p) => acc + Number(p.totalAmount), 0);

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        description="Streaming, domínios e outras cobranças recorrentes, separadas das suas compras."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova assinatura
          </Button>
        }
      />

      {!isLoading && active.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted">Assinaturas ativas</p>
              <p className="text-2xl font-bold">{active.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted">Total mensal</p>
              <p className="text-2xl font-bold">{formatCurrency(monthlyTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted">Total anual</p>
              <p className="text-2xl font-bold">{formatCurrency(annualTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && autoRenewChartData.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Renovação automática</CardTitle>
          </CardHeader>
          <CardContent>
            <AutoRenewChart data={autoRenewChartData} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-6 w-6" />}
          title="Nenhuma assinatura cadastrada"
          description="Netflix, Spotify, domínios registrados — qualquer cobrança que se repete sozinha vai aqui."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nova assinatura
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((p) => {
            const nextInstallment = p.installments?.find((i) => i.status === "PENDING");
            const cancelled = isCancelled(p);
            const scheduled = isScheduled(p);

            return (
              <Card key={p.id} className={cancelled ? "opacity-60" : ""}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <PurchaseIcon purchase={p} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs text-muted">
                          {p.card.name} · {p.category?.name ?? "Sem categoria"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{p.billingCycle === "ANNUAL" ? "Anual" : "Mensal"}</Badge>
                    {p.autoRenew === false ? (
                      <Badge tone="warning">
                        <RefreshCwOff className="h-3 w-3" /> Sem renovação automática
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        <RefreshCw className="h-3 w-3" /> Renova sozinha
                      </Badge>
                    )}
                    {cancelled && <Badge tone="neutral">Cancelada</Badge>}
                    {scheduled && !cancelled && <Badge tone="warning">Cancelamento agendado</Badge>}
                  </div>

                  <div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(p.totalAmount)}
                      <span className="ml-1 text-sm font-normal text-muted">
                        {p.billingCycle === "ANNUAL" ? "/ano" : "/mês"}
                      </span>
                    </p>
                  </div>

                  {nextInstallment && !cancelled && (
                    <div className="flex items-center gap-2 rounded-xl surface-2 px-3 py-2 text-sm">
                      <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
                      <span>
                        Próxima renovação: <span className="font-medium">{formatDate(nextInstallment.dueDate)}</span>
                      </span>
                    </div>
                  )}

                  {scheduled && (
                    <p className="text-xs text-amber-500">
                      Cobra até {formatDate(p.recurrenceEndDate!)}, depois cancela sozinha.
                    </p>
                  )}

                  {!cancelled && (
                    <div className="flex items-center gap-2 border-t border-[rgb(var(--border))] pt-3">
                      {!scheduled && (
                        <Button variant="outline" size="sm" onClick={() => setScheduleTargetId(p.id)}>
                          <CalendarClock className="h-3.5 w-3.5" /> Planejar cancelamento
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Cancelar a assinatura "${p.name}" agora? As cobranças futuras serão removidas.`)) {
                            cancelRecurrence.mutate(p.id);
                          }
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 text-red-500" /> Cancelar agora
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SubscriptionFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <ScheduleCancellationModal
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTargetId(null)}
        subscription={scheduleTarget}
      />
    </div>
  );
}
