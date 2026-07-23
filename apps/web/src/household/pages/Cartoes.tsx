import { useState } from "react";
import { Plus, CreditCard as CreditCardIcon, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { useHouseholdCards, useHouseholdCardsMonth, useUpdateHouseholdCardEntry } from "../api";
import { HouseholdCard, HouseholdCardEntry } from "../types";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { HouseholdCardFormModal } from "../components/HouseholdCardFormModal";
import { CardEntryFormModal } from "../components/CardEntryFormModal";
import { InlineAmountCell } from "../components/InlineAmountCell";

export default function Cartoes() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: cards, isLoading: loadingCards } = useHouseholdCards();
  const { data: entries, isLoading: loadingEntries } = useHouseholdCardsMonth(year, month);
  const updateEntry = useUpdateHouseholdCardEntry();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<HouseholdCard | null>(null);
  const [launchCard, setLaunchCard] = useState<HouseholdCard | null>(null);

  const isLoading = loadingCards || loadingEntries;
  const activeCards = (cards ?? []).filter((c) => c.active);
  const entryByCard = new Map<string, HouseholdCardEntry>((entries ?? []).map((e) => [e.cardId, e]));

  function openCreate() {
    setEditingCard(null);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cartões de Crédito</h1>
          <p className="text-sm text-muted">Valor real a pagar = valor total da fatura menos o que já estava provisionado.</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher year={year} month={month} onChange={(y, m) => (setYear(y), setMonth(m))} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo cartão
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {!isLoading && activeCards.length === 0 && (
        <EmptyState
          icon={<CreditCardIcon className="h-7 w-7" />}
          title="Nenhum cartão cadastrado"
          description="Cadastre seus cartões pra lançar a fatura de cada mês e saber quanto realmente falta pagar."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar cartão
            </Button>
          }
        />
      )}

      {!isLoading && activeCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeCards.map((card) => {
            const entry = entryByCard.get(card.id);
            return (
              <Card key={card.id}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: card.color }}>
                        <CreditCardIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">{card.name}</p>
                        <p className="text-xs text-muted">
                          Fecha dia {card.closingDay} · vence dia {card.dueDay}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingCard(card);
                        setFormOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
                      aria-label="Editar cartão"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>

                  {!entry ? (
                    <Button variant="outline" onClick={() => setLaunchCard(card)}>
                      <Plus className="h-4 w-4" />
                      Lançar fatura de {String(month).padStart(2, "0")}/{year}
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Fatura total</span>
                        <InlineAmountCell
                          value={Number(entry.totalInvoice)}
                          onSave={(v) => updateEntry.mutate({ id: entry.id, data: { totalInvoice: v } })}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Provisionado</span>
                        <InlineAmountCell
                          value={Number(entry.provisioned)}
                          onSave={(v) => updateEntry.mutate({ id: entry.id, data: { provisioned: v } })}
                        />
                      </div>
                      <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3 text-sm font-semibold">
                        <span>Real a pagar</span>
                        <span>{formatCurrency(entry.realAmount)}</span>
                      </div>
                      <button
                        onClick={() => updateEntry.mutate({ id: entry.id, data: { paid: !entry.paid } })}
                        className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
                          entry.paid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "surface-2 text-muted hover:brightness-95"
                        }`}
                      >
                        {entry.paid ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        {entry.paid ? "Fatura paga" : "Marcar como paga"}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <HouseholdCardFormModal open={formOpen} onClose={() => setFormOpen(false)} card={editingCard} />
      <CardEntryFormModal open={!!launchCard} onClose={() => setLaunchCard(null)} card={launchCard} year={year} month={month} />
    </div>
  );
}
