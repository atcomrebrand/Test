import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { useCrmFinancial } from "../api";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "month", label: "Este mês" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
];

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="font-semibold">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function Financeiro() {
  const [period, setPeriod] = useState("month");
  const { data: f, isLoading } = useCrmFinancial(period);

  if (isLoading || !f) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Financeiro"
        description="Quanto entrou, de onde veio e o que sobrou depois das taxas."
        actions={<Select options={PERIODS} value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />}
      />

      {/* Bruto → taxas → líquido na mesma linha de leitura: o bruto sozinho superestima o que de
          fato entrou na conta. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted">Receita bruta</p>
            <p className="mt-0.5 text-2xl font-bold">{formatCurrency(f.gross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted">Taxas</p>
            <p className="mt-0.5 text-2xl font-bold text-red-500">−{formatCurrency(f.fees)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted">Receita líquida</p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-500">{formatCurrency(f.net)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted">Pendente</p>
            <p className="mt-0.5 text-2xl font-bold text-amber-500">{formatCurrency(f.pending.amount)}</p>
            <p className="text-[11px] text-muted">{f.pending.count} vencido(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* §55: as duas origens nunca aparecem fundidas num número só. */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <p className="text-sm font-semibold">De onde veio a receita</p>
          <Bar label="Clientes diretos (assinaturas)" value={f.revenue.direct} total={f.revenue.total} color="#10b981" />
          <Bar label="Revendedores (recargas)" value={f.revenue.reseller} total={f.revenue.total} color="#8b5cf6" />
          <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-bold">{formatCurrency(f.revenue.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted">
            <span>
              {f.paymentsCount} pagamento(s) · ticket {f.averageTicket !== null ? formatCurrency(f.averageTicket) : "—"}
            </span>
            <span className="text-right">
              {f.rechargesCount} recarga(s) · ticket{" "}
              {f.averageRechargeTicket !== null ? formatCurrency(f.averageRechargeTicket) : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-sm font-semibold">Por forma de pagamento</p>
            {f.byPaymentMethod.length === 0 ? (
              <p className="text-sm text-muted">Nenhum pagamento no período.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {f.byPaymentMethod.map((m) => (
                  <Bar key={m.name} label={`${m.name} (${m.count})`} value={m.total} total={f.revenue.direct} color="#6366f1" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-sm font-semibold">Recorrência por plano</p>
            {f.byPlan.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma assinatura ativa.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {f.byPlan.map((p) => (
                  <Bar
                    key={p.planId ?? "none"}
                    label={`${p.name} (${p.count})`}
                    value={p.monthlyRecurring}
                    total={f.byPlan.reduce((s, x) => s + x.monthlyRecurring, 0)}
                    color="#0ea5e9"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
