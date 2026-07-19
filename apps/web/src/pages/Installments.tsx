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
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))]">
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
                      {inst.status === "PAID" ? (
                        <button
                          onClick={() => unpay.mutate(inst.id)}
                          className="rounded-lg p-1.5 transition-colors hover:surface-2"
                          title="Reverter pagamento"
                        >
                          <Undo2 className="h-4 w-4 text-muted" />
                        </button>
                      ) : inst.status === "CANCELLED" ? null : (
                        <>
                          <button
                            onClick={() => pay.mutate({ id: inst.id })}
                            className="rounded-lg p-1.5 transition-colors hover:surface-2"
                            title="Marcar como paga"
                          >
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
