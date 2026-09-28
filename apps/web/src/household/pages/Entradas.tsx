import { useState } from "react";
import { Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDeleteHouseholdIncome, useHouseholdIncomesMonth } from "../api";
import { HouseholdIncome } from "../types";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { HouseholdIncomeFormModal } from "../components/HouseholdIncomeFormModal";

export default function Entradas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: incomes, isLoading } = useHouseholdIncomesMonth(year, month);
  const remove = useDeleteHouseholdIncome();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<HouseholdIncome | null>(null);

  function openCreate() {
    setEditingIncome(null);
    setFormOpen(true);
  }

  function openEdit(income: HouseholdIncome) {
    setEditingIncome(income);
    setFormOpen(true);
  }

  const total = (incomes ?? []).reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entradas</h1>
          <p className="text-sm text-muted">Salário, freelance, investimentos e outras receitas do mês.</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher year={year} month={month} onChange={(y, m) => (setYear(y), setMonth(m))} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nova entrada
          </Button>
        </div>
      </div>

      {!isLoading && incomes && incomes.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm text-muted">Total de entradas no mês</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(total)}</span>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!incomes || incomes.length === 0) && (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhuma entrada neste mês"
          description="Cadastre salário, freelas e outras receitas pra saber quanto realmente entrou."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar entrada
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {incomes?.map((income) => (
          <Card key={income.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{income.description || income.category?.name || "Entrada"}</p>
                  {income.category && <Badge tone="neutral">{income.category.name}</Badge>}
                  {income.isForeignCurrency && <Badge tone="accent">Dinheiro Gringo</Badge>}
                </div>
                <p className="text-xs text-muted">
                  {formatDate(income.date)}
                  {income.isForeignCurrency && income.grossAmountForeign && income.exchangeRate
                    ? ` · US$ ${Number(income.grossAmountForeign).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} @ ${Number(income.exchangeRate).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}`
                    : ""}
                </p>
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

      <HouseholdIncomeFormModal open={formOpen} onClose={() => setFormOpen(false)} income={editingIncome} />
    </div>
  );
}
