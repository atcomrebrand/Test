import { useState } from "react";
import { Plus, ShoppingBag, Search, Star, Copy, Trash2, Pencil, ChevronLeft, ChevronRight, Repeat, Ban } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PurchaseFormModal } from "@/components/PurchaseFormModal";
import { useCards } from "@/features/useCards";
import { useCategories } from "@/features/useCategories";
import { useCancelRecurrence, useDuplicatePurchase, usePurchases, useTrashPurchase, useUpdatePurchase } from "@/features/usePurchases";
import { formatCurrency, formatDate } from "@/lib/format";
import { Purchase } from "@/types";

export default function Purchases() {
  const [filters, setFilters] = useState({ search: "", cardId: "", categoryId: "", kind: "", favorite: false, page: 1 });
  const { data: cards } = useCards();
  const { data: categories } = useCategories();
  const { data, isLoading, isFetching } = usePurchases({
    ...filters,
    cardId: filters.cardId || undefined,
    categoryId: filters.categoryId || undefined,
    kind: filters.kind || undefined,
    favorite: filters.favorite || undefined,
    search: filters.search || undefined,
    pageSize: 10,
  });

  const trash = useTrashPurchase();
  const duplicate = useDuplicatePurchase();
  const updatePurchase = useUpdatePurchase();
  const cancelRecurrence = useCancelRecurrence();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Purchase) {
    setEditing(p);
    setModalOpen(true);
  }

  const purchases = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Todas as compras lançadas nos seus cartões."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova compra
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl surface border border-[rgb(var(--border))] p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            placeholder="Buscar por nome, estabelecimento..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            className="h-10 w-full rounded-xl surface-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent-500/20"
          />
        </div>
        <Select
          className="w-44"
          options={[{ value: "", label: "Todos os cartões" }, ...(cards ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={filters.cardId}
          onChange={(e) => setFilters({ ...filters, cardId: e.target.value, page: 1 })}
        />
        <Select
          className="w-44"
          options={[{ value: "", label: "Todas categorias" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}
        />
        <Select
          className="w-40"
          options={[
            { value: "", label: "Todos os tipos" },
            { value: "CASH", label: "À vista" },
            { value: "INSTALLMENT", label: "Parcelada" },
            { value: "RECURRING", label: "Assinatura" },
          ]}
          value={filters.kind}
          onChange={(e) => setFilters({ ...filters, kind: e.target.value, page: 1 })}
        />
        <button
          onClick={() => setFilters({ ...filters, favorite: !filters.favorite, page: 1 })}
          className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors ${filters.favorite ? "bg-amber-400/20 text-amber-500" : "surface-2 text-muted"}`}
        >
          <Star className={`h-4 w-4 ${filters.favorite ? "fill-amber-400" : ""}`} /> Favoritas
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Nenhuma compra encontrada"
          description="Ajuste os filtros ou lance uma nova compra."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova compra
            </Button>
          }
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {purchases.map((p) => {
            const paidCount = p.installments?.filter((i) => i.status === "PAID").length ?? 0;
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl surface border border-[rgb(var(--border))] p-4 shadow-soft transition-shadow hover:shadow-elevated sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex items-center gap-3 sm:contents">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: p.category?.color ?? "#999" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 sm:justify-start">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium">{p.name}</p>
                        {p.isFavorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                      </div>
                      <p className="shrink-0 font-semibold sm:hidden">
                        {formatCurrency(p.totalAmount)}
                        {p.kind === "RECURRING" && <span className="text-xs text-muted">/mês</span>}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {p.card.name} · {p.category?.name ?? "Sem categoria"} · {formatDate(p.purchaseDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:contents">
                  <div className="text-xs text-muted">
                    {p.kind === "CASH" ? (
                      <Badge tone="neutral">À vista</Badge>
                    ) : p.kind === "RECURRING" ? (
                      <Badge tone={p.recurrenceEndDate ? "neutral" : "accent"}>
                        <Repeat className="h-3 w-3" /> {p.recurrenceEndDate ? "Cancelada" : "Assinatura"}
                      </Badge>
                    ) : (
                      <Badge tone="accent">{paidCount}/{p.installmentsCount} pagas</Badge>
                    )}
                  </div>

                  <p className="hidden w-28 text-right font-semibold sm:block">
                    {formatCurrency(p.totalAmount)}
                    {p.kind === "RECURRING" && <span className="block text-xs font-normal text-muted">/mês</span>}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updatePurchase.mutate({ id: p.id, data: { isFavorite: !p.isFavorite } })}
                      className="rounded-lg p-2 transition-colors hover:surface-2"
                      title="Favoritar"
                    >
                      <Star className={`h-4 w-4 ${p.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                    </button>
                    <button onClick={() => openEdit(p)} className="rounded-lg p-2 transition-colors hover:surface-2" title="Editar">
                      <Pencil className="h-4 w-4 text-muted" />
                    </button>
                    {p.kind === "RECURRING" && !p.recurrenceEndDate ? (
                      <button
                        onClick={() => {
                          if (confirm(`Cancelar a assinatura "${p.name}"? As cobranças futuras serão removidas.`)) {
                            cancelRecurrence.mutate(p.id);
                          }
                        }}
                        className="rounded-lg p-2 transition-colors hover:surface-2"
                        title="Cancelar assinatura"
                      >
                        <Ban className="h-4 w-4 text-amber-500" />
                      </button>
                    ) : (
                      <button
                        onClick={() => duplicate.mutate(p.id)}
                        className="rounded-lg p-2 transition-colors hover:surface-2"
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4 text-muted" />
                      </button>
                    )}
                    <button
                      onClick={() => trash.mutate(p.id)}
                      className="rounded-lg p-2 transition-colors hover:surface-2"
                      title="Mover para lixeira"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
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

      <PurchaseFormModal open={modalOpen} onClose={() => setModalOpen(false)} purchase={editing} />
    </div>
  );
}
