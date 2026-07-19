import { useState } from "react";
import { Plus, CreditCard as CreditCardIcon, Pencil, Trash2, Power } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreditCardVisual } from "@/components/CreditCardVisual";
import { CardFormModal } from "@/components/CardFormModal";
import { useCards, useDeleteCard, useUpdateCard } from "@/features/useCards";
import { formatCurrency } from "@/lib/format";
import { CreditCard } from "@/types";

export default function Cards() {
  const { data: cards, isLoading } = useCards();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(card: CreditCard) {
    setEditing(card);
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Cartões"
        description="Gerencie seus cartões de crédito."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo cartão
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : !cards || cards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="h-6 w-6" />}
          title="Nenhum cartão cadastrado"
          description="Adicione seu primeiro cartão para começar a lançar compras."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo cartão
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            return (
              <div key={card.id} className="flex flex-col gap-3">
                <CreditCardVisual card={card} onClick={() => openEdit(card)} />
                <div className="flex items-center justify-between rounded-xl surface-2 px-3 py-2 text-xs">
                  <span className="text-muted">Limite {formatCurrency(card.limitAmount)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCard.mutate({ id: card.id, data: { active: !card.active } })}
                      className="rounded-lg p-1.5 transition-colors hover:surface"
                      title={card.active ? "Desativar" : "Ativar"}
                    >
                      <Power className={`h-3.5 w-3.5 ${card.active ? "text-emerald-500" : "text-muted"}`} />
                    </button>
                    <button onClick={() => openEdit(card)} className="rounded-lg p-1.5 transition-colors hover:surface" title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir o cartão "${card.name}"? Só é possível se não houver compras vinculadas.`)) {
                          deleteCard.mutate(card.id);
                        }
                      }}
                      className="rounded-lg p-1.5 transition-colors hover:surface"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CardFormModal open={modalOpen} onClose={() => setModalOpen(false)} card={editing} />
    </div>
  );
}
