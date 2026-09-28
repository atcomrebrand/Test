import { LifeBuoy, Star } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCrmDashboard, useCrmRetention, useCrmRetentionQueue } from "../api";
import { DueRow } from "../components/DueRow";

export default function Retencao() {
  const { data: fila, isLoading } = useCrmRetentionQueue();
  const { data: coortes } = useCrmRetention();
  const { data: dash } = useCrmDashboard();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Retenção" description="Quem saiu, quem está saindo e quem vale a pena trazer de volta." />

      {dash && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Perdidos no mês</p>
            <p className="text-xl font-bold text-red-500">{dash.churn.lost}</p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Novos no mês</p>
            <p className="text-xl font-bold text-emerald-500">{dash.churn.gained}</p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Crescimento líquido</p>
            <p className="text-xl font-bold">
              {dash.churn.netGrowth >= 0 ? "+" : ""}
              {dash.churn.netGrowth}
            </p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Churn do mês</p>
            {/* Null quando não havia base: 0% diria que ninguém saiu, e não é a mesma coisa. */}
            <p className="text-xl font-bold">{dash.churn.churnRate !== null ? `${dash.churn.churnRate}%` : "—"}</p>
          </div>
        </div>
      )}

      {coortes && coortes.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="mb-1 text-sm font-semibold">Retenção por tempo</p>
            <p className="mb-3 text-xs text-muted">
              Só conta quem já teve tempo de alcançar cada marco — cliente novo não derruba a coluna de 12 meses.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {coortes.map((c) => (
                <div key={c.months} className="surface-2 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold">{c.rate !== null ? `${c.rate}%` : "—"}</p>
                  <p className="text-[11px] text-muted">{c.months}m</p>
                  <p className="text-[10px] text-muted">
                    {c.retained}/{c.eligible}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Clientes para recuperar</h2>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !fila || fila.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-6 w-6" />}
            title="Ninguém pra recuperar"
            description="Nenhum cliente vencido no momento."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {fila.map((c) => (
              <div key={c.id} className="relative">
                {c.vip && (
                  <span className="absolute -left-1 -top-1 z-10 flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                    <Star className="h-2.5 w-2.5 fill-current" /> VIP
                  </span>
                )}
                <DueRow customer={c} tone="late" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
