import { useState } from "react";
import { ListChecks, Check, Undo2, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/ui/Input";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCards } from "@/features/useCards";
import { useInstallments, usePayInstallment, useUnpayInstallment, useUpdateInstallmentStatus } from "@/features/useInstallments";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { Installment } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "PAID", label: "Pago" },
  { value: "LATE", label: "Atrasado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export default function Installments() {
  const [filters, setFilters] = useState({ status: "", cardId: "", page: 1 });
  const { data: cards } = useCards();
  const { data, isLoading } = useInstallments({
    ...filters,
    status: (filters.status || undefined) as any,
    cardId: filters.cardId || undefined,
    pageSize: 20,
  });
  const pay = usePayInstallment();
  const unpay = useUnpayInstallment();
  const updateStatus = useUpdateInstallmentStatus();

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <PageHeader title="Parcelas" description="Controle o status de cada parcela lançada." />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl surface border border-[rgb(var(--border))] p-3">
        <Select
          className="w-44"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        />
        <Select
          className="w-48"
          options={[{ value: "", label: "Todos os cartões" }, ...(cards ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={filters.cardId}
          onChange={(e) => setFilters({ ...filters, cardId: e.target.value, page: 1 })}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nenhuma parcela encontrada" description="Ajuste os filtros para ver mais resultados." />
      ) : (
        <>
          {/* Mobile: card list — a table with 8 columns can't fit a phone screen. */}
          <div className="space-y-2 sm:hidden">
            {items.map((inst) => (
              <div key={inst.id} className="rounded-2xl surface border border-[rgb(var(--border))] p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inst.purchase?.name}</p>
                    <p className="text-xs text-muted">
                      {inst.card?.name} · Parcela {inst.number}/{inst.purchase?.installmentsCount}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[inst.status]} className="shrink-0">
                    {STATUS_LABEL[inst.status]}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-xs text-muted">
                    {monthLabel(inst.referenceMonth, inst.referenceYear, true)} · vence {formatDate(inst.dueDate)}
                  </p>
                  <p className="font-semibold">{formatCurrency(inst.amount)}</p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-[rgb(var(--border))] pt-2">
                  <InstallmentRowActions inst={inst} pay={pay} unpay={unpay} updateStatus={updateStatus} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: full table. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[rgb(var(--border))] sm:block">
            <table className="w-full text-sm">
              <thead className="surface-2 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Compra</th>
                  <th className="px-4 py-3 font-medium">Cartão</th>
                  <th className="px-4 py-3 font-medium">Parcela</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="surface divide-y divide-[rgb(var(--border))]">
                {items.map((inst) => (
                  <tr key={inst.id} className="transition-colors hover:surface-2">
                    <td className="px-4 py-3">
                      <p className="font-medium">{inst.purchase?.name}</p>
                      <p className="text-xs text-muted">{inst.purchase?.category?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{inst.card?.name}</td>
                    <td className="px-4 py-3">
                      {inst.number}/{inst.purchase?.installmentsCount}
                    </td>
                    <td className="px-4 py-3 text-muted">{monthLabel(inst.referenceMonth, inst.referenceYear, true)}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(inst.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inst.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[inst.status]}>{STATUS_LABEL[inst.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <InstallmentRowActions inst={inst} pay={pay} unpay={unpay} updateStatus={updateStatus} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface InstallmentRowActionsProps {
  inst: Installment;
  pay: ReturnType<typeof usePayInstallment>;
  unpay: ReturnType<typeof useUnpayInstallment>;
  updateStatus: ReturnType<typeof useUpdateInstallmentStatus>;
}

function InstallmentRowActions({ inst, pay, unpay, updateStatus }: InstallmentRowActionsProps) {
  if (inst.status === "PAID") {
    return (
      <button onClick={() => unpay.mutate(inst.id)} className="rounded-lg p-1.5 transition-colors hover:surface-2" title="Reverter pagamento">
        <Undo2 className="h-4 w-4 text-muted" />
      </button>
    );
  }
  if (inst.status === "CANCELLED") return null;
  return (
    <>
      <button onClick={() => pay.mutate({ id: inst.id })} className="rounded-lg p-1.5 transition-colors hover:surface-2" title="Marcar como paga">
        <Check className="h-4 w-4 text-emerald-500" />
      </button>
      <button
        onClick={() => updateStatus.mutate({ id: inst.id, status: "CANCELLED" })}
        className="rounded-lg p-1.5 transition-colors hover:surface-2"
        title="Cancelar parcela"
      >
        <Ban className="h-4 w-4 text-amber-500" />
      </button>
    </>
  );
}
