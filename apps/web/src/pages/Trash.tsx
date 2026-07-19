import { Trash2, RotateCcw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePurchases, useRestorePurchase, useDeletePurchaseForever } from "@/features/usePurchases";
import { formatCurrency, formatDate } from "@/lib/format";

export default function Trash() {
  const { data, isLoading } = usePurchases({ trashed: true, pageSize: 50 });
  const restore = useRestorePurchase();
  const remove = useDeletePurchaseForever();

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Lixeira" description="Compras excluídas podem ser restauradas por aqui." />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Trash2 className="h-6 w-6" />} title="Lixeira vazia" description="Compras excluídas aparecerão aqui." />
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-2xl surface border border-[rgb(var(--border))] p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.card.name} · {formatDate(p.purchaseDate)}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(p.totalAmount)}</p>
              <button
                onClick={() => restore.mutate(p.id)}
                className="flex items-center gap-1.5 rounded-xl surface-2 px-3 py-1.5 text-sm font-medium transition-colors hover:brightness-95 dark:hover:brightness-110"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
              </button>
              <button
                onClick={() => confirm("Excluir permanentemente? Esta ação não pode ser desfeita.") && remove.mutate(p.id)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
              >
                <XCircle className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
