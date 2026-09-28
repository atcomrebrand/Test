import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Pencil, RotateCcw, Star, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useCancelCrmCustomer,
  useCrmCustomer,
  useReactivateCrmCustomer,
  useReversePayment,
} from "../api";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { SubscriptionModal } from "../components/SubscriptionModal";
import { CustomerStatusBadge, PortfolioDot } from "../components/StatusBadge";
import { RenewButton, WhatsappButton } from "../components/QuickActions";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface-2 rounded-xl p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading } = useCrmCustomer(id);
  const cancel = useCancelCrmCustomer();
  const reactivate = useReactivateCrmCustomer();
  const reverse = useReversePayment();
  const [editando, setEditando] = useState(false);
  const [assinando, setAssinando] = useState(false);

  if (isLoading || !c) return <Skeleton className="h-96" />;

  const cancelado = c.status === "CANCELLED" || c.status === "INACTIVE";

  return (
    <div className="flex flex-col gap-5">
      <Link to="/crm/clientes" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {c.vip && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
              <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
              <CustomerStatusBadge status={c.status} daysLate={c.daysLate} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <PortfolioDot name={c.portfolio.name} color={c.portfolio.color} />
              <span>· {c.phone}</span>
              {c.email && <span>· {c.email}</span>}
            </div>
            {/* Tempo de casa (§10): o número em meses ao lado do rótulo, porque "2 anos e 4 meses"
                é o que se fala, mas "28 meses" é o que se compara. */}
            {c.tenure && (
              <p className="mt-2 text-sm">
                Cliente há <strong>{c.tenure.label}</strong>{" "}
                <span className="text-muted">({c.tenure.months} meses de assinatura)</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <WhatsappButton customerId={c.id} size="md" />
            <RenewButton subscriptionId={c.activeSubscription?.id} size="md" />
            <Button variant="ghost" size="md" onClick={() => setEditando(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            {cancelado ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => reactivate.mutate(c.id)}
                loading={reactivate.isPending}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reativar
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="md"
                onClick={() => cancel.mutate({ id: c.id })}
                loading={cancel.isPending}
                className="gap-1.5 text-red-500"
              >
                <Ban className="h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Receita gerada (§13). Bruto, taxas e líquido juntos: o bruto sozinho superestima o que
          entrou de verdade, e é o líquido que paga as contas. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Receita gerada</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total histórico" value={formatCurrency(c.revenue.total)} sub={`${c.revenue.count} pagamento(s)`} />
          <Stat label="Últimos 30 dias" value={formatCurrency(c.revenue.last30)} />
          <Stat label="Últimos 6 meses" value={formatCurrency(c.revenue.last6Months)} />
          <Stat label="Últimos 12 meses" value={formatCurrency(c.revenue.last12Months)} />
          <Stat label="Bruto" value={formatCurrency(c.revenue.gross)} />
          <Stat label="Taxas" value={`−${formatCurrency(c.revenue.fees)}`} />
          <Stat label="Líquido" value={formatCurrency(c.revenue.net)} />
          <Stat
            label="Ticket médio"
            value={c.averageTicket !== null ? formatCurrency(c.averageTicket) : "—"}
            sub={
              c.revenue.firstPaymentAt
                ? `1º em ${formatDate(c.revenue.firstPaymentAt)}`
                : "sem pagamentos ainda"
            }
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Assinaturas</h2>
          <Button size="sm" variant="secondary" onClick={() => setAssinando(true)}>
            Nova assinatura
          </Button>
        </div>
        {c.subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted">
              Nenhuma assinatura. Crie uma pra o cliente entrar no controle de vencimentos.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {c.subscriptions.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.plan?.name ?? "Sem plano"}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.startDate)} → vence {formatDate(s.dueDate)}
                      {s.lastPaymentAt && ` · último pgto ${formatDate(s.lastPaymentAt)}`}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(s.amount)}</span>
                  <span className="text-xs text-muted">{s.status === "ACTIVE" ? "Ativa" : "Encerrada"}</span>
                  {s.status === "ACTIVE" && <RenewButton subscriptionId={s.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Pagamentos</h2>
        {c.payments.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted">Nenhum pagamento registrado.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y divide-[rgb(var(--border))] py-0">
              {c.payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{formatDate(p.paidAt)}</p>
                    <p className="text-xs text-muted">
                      {p.paymentMethodName ?? "Sem forma"}
                      {Number(p.feeAmount) > 0 && ` · taxa ${formatCurrency(p.feeAmount)}`}
                      {p.periodStart && p.periodEnd && ` · ${formatDate(p.periodStart)}–${formatDate(p.periodEnd)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={p.reversedAt ? "font-semibold text-muted line-through" : "font-semibold"}>
                      {formatCurrency(p.grossAmount)}
                    </p>
                    <p className="text-[11px] text-muted">líq. {formatCurrency(p.netAmount)}</p>
                  </div>
                  {/* Estornado continua no extrato, riscado: some das somas mas não da história. */}
                  {p.reversedAt ? (
                    <span className="text-xs text-muted">estornado</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reverse.mutate(p.id)}
                      className="gap-1 text-xs text-muted"
                    >
                      <Undo2 className="h-3 w-3" /> Estornar
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {c.events.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Histórico</h2>
          <Card>
            <CardContent className="py-4">
              <ol className="relative flex flex-col gap-4 border-l border-[rgb(var(--border))] pl-5">
                {c.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                    <p className="text-xs text-muted">{formatDate(e.createdAt)}</p>
                    <p className="text-sm">
                      {e.description}
                      {e.amount !== null && <strong> · {formatCurrency(e.amount)}</strong>}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      )}

      <CustomerFormModal open={editando} onClose={() => setEditando(false)} customer={c} />
      <SubscriptionModal open={assinando} onClose={() => setAssinando(false)} customer={c} />
    </div>
  );
}
