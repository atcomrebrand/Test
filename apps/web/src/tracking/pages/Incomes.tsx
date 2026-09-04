import { useState } from "react";
import { Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTrackingIncomes, useDeleteTrackingIncome } from "../api";
import { IncomeFormModal } from "../components/IncomeFormModal";
import { TrackingIncome } from "../types";

const CATEGORY_LABEL: Record<string, string> = {
  DIVIDENDO: "Dividendos",
  VENDA: "Venda",
  BONIFICACAO: "Bonificação",
  CASHBACK: "Cashback",
  REEMBOLSO: "Reembolso",
  PRESENTE: "Presente",
  OUTRO: "Outro",
};

export default function Incomes() {
  const { data, isLoading } = useTrackingIncomes();
  const remove = useDeleteTrackingIncome();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<TrackingIncome | null>(null);

  function openCreate() {
    setEditingIncome(null);
    setFormOpen(true);
  }

  function openEdit(income: TrackingIncome) {
    setEditingIncome(income);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Outras Entradas</h1>
          <p className="text-sm text-muted">Dividendos, vendas, cashback e outras receitas avulsas.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova entrada
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhuma entrada cadastrada"
          description="Cadastre qualquer receita avulsa pra contar no seu faturamento total."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar entrada
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {data?.map((income) => (
          <Card key={income.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{income.name}</p>
                  <Badge tone="neutral">{CATEGORY_LABEL[income.category]}</Badge>
                </div>
                <p className="text-xs text-muted">{formatDate(income.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(income.amount)}</p>
                <button onClick={() => openEdit(income)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove.mutate(income.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <IncomeFormModal open={formOpen} onClose={() => setFormOpen(false)} income={editingIncome} />
    </div>
  );
}
