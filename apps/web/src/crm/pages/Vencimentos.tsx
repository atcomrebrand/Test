import { CalendarClock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useCrmDueBoard } from "../api";
import { DueRow } from "../components/DueRow";

function WindowCard({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", tone)}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-[11px] leading-tight">{label}</p>
    </div>
  );
}

/**
 * Painel de vencimentos (§6). As janelas em cima como resumo, e embaixo as listas que dão pra agir:
 * atrasados primeiro, porque é o grupo que perde dinheiro se ficar mais um dia parado.
 */
export default function Vencimentos() {
  const { data, isLoading } = useCrmDueBoard();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const nada =
    data.late.customers.length === 0 && data.today.customers.length === 0 && data.tomorrow.customers.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Vencimentos" description="Quem vence quando — e o botão pra resolver na mesma linha." />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <WindowCard
          label="Atrasados"
          count={data.late.count}
          tone="border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
        />
        <WindowCard
          label="Vencem hoje"
          count={data.today.count}
          tone="border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
        />
        <WindowCard
          label="Amanhã"
          count={data.tomorrow.count}
          tone="border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400"
        />
        <WindowCard label="Próx. 3 dias" count={data.next3Days.count} tone="border-[rgb(var(--border))] surface" />
        <WindowCard label="Próx. 7 dias" count={data.next7Days.count} tone="border-[rgb(var(--border))] surface" />
        <WindowCard label="Próx. 30 dias" count={data.next30Days.count} tone="border-[rgb(var(--border))] surface" />
      </div>

      {nada ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Nada vencendo agora"
          description="Nenhum cliente atrasado, vencendo hoje ou amanhã. As janelas maiores acima continuam valendo."
        />
      ) : (
        <>
          {data.late.customers.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                Atrasados ({data.late.count})
              </h2>
              <div className="flex flex-col gap-2">
                {data.late.customers.map((c) => (
                  <DueRow key={c.id} customer={c} tone="late" />
                ))}
              </div>
            </section>
          )}

          {data.today.customers.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                Vencem hoje ({data.today.count})
              </h2>
              <div className="flex flex-col gap-2">
                {data.today.customers.map((c) => (
                  <DueRow key={c.id} customer={c} tone="today" />
                ))}
              </div>
            </section>
          )}

          {data.tomorrow.customers.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-sky-600 dark:text-sky-400">
                Vencem amanhã ({data.tomorrow.count})
              </h2>
              <div className="flex flex-col gap-2">
                {data.tomorrow.customers.map((c) => (
                  <DueRow key={c.id} customer={c} tone="tomorrow" />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {data.next30Days.count > data.next7Days.count && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3 text-sm text-muted">
            <CalendarClock className="h-4 w-4 shrink-0" />
            Mais {data.next30Days.count - data.next7Days.count} cliente(s) vencem entre 8 e 30 dias — use o filtro em
            Clientes pra ver a lista completa.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
