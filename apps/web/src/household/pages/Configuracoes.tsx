import { FormEvent, useEffect, useState } from "react";
import { Plus, Tag, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, parseAmountInput } from "@/lib/format";
import { useQuotesTicker } from "@/features/useQuotes";
import {
  useHouseholdBillCategories,
  useCreateHouseholdBillCategory,
  useDeleteHouseholdBillCategory,
  useReorderHouseholdBillCategories,
  useHouseholdIncomeCategories,
  useCreateHouseholdIncomeCategory,
  useDeleteHouseholdIncomeCategory,
  useReorderHouseholdIncomeCategories,
  useHouseholdPresumedSalary,
  useUpdateHouseholdPresumedSalary,
} from "../api";
import { HouseholdBillCategory, HouseholdIncomeCategory } from "../types";

const COLORS = ["#F59E0B", "#22C55E", "#3B82F6", "#06B6D4", "#A855F7", "#EF4444", "#EC4899", "#EAB308", "#14B8A6", "#8B5CF6", "#6B7280"];

interface CategorySectionProps<T extends { id: string; name: string; color: string }> {
  title: string;
  description: string;
  categories: T[] | undefined;
  isLoading: boolean;
  onCreate: (data: { name: string; color: string }) => void;
  creating: boolean;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}

function CategorySection<T extends { id: string; name: string; color: string }>({
  title,
  description,
  categories,
  isLoading,
  onCreate,
  creating,
  onDelete,
  onReorder,
}: CategorySectionProps<T>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onCreate({ name, color });
    setOpen(false);
    setName("");
  }

  function move(index: number, direction: -1 | 1) {
    if (!categories) return;
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}

        {!isLoading && (!categories || categories.length === 0) && <p className="py-4 text-center text-sm text-muted">Nenhuma categoria cadastrada.</p>}

        {categories?.map((cat, index) => (
          <div key={cat.id} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: cat.color }}>
              <Tag className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 truncate text-sm font-medium">{cat.name}</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded-lg p-1 text-muted transition-colors hover:surface-2 disabled:opacity-30"
                aria-label="Mover para cima"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => move(index, 1)}
                disabled={index === categories.length - 1}
                className="rounded-lg p-1 text-muted transition-colors hover:surface-2 disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => confirm(`Excluir categoria "${cat.name}"?`) && onDelete(cat.id)}
                className="rounded-lg p-1 transition-colors hover:surface-2"
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova categoria" size="sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <div>
            <p className="mb-1.5 text-sm font-medium">Cor</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--surface))] transition-transform hover:scale-110"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={creating}>
              Criar categoria
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/** O "chão" que o Dashboard usa quando o mês ainda não tem nenhuma entrada lançada — o salário
 *  simplesmente ainda não caiu. Em dólar, o preview abaixo já mostra a conversão pela cotação
 *  atual, mas o valor de fato usado no Dashboard é sempre recalculado na hora (nunca travado
 *  nessa cotação de quando foi salvo). */
function PresumedSalaryCard() {
  const { data, isLoading } = useHouseholdPresumedSalary();
  const { data: quotes } = useQuotesTicker();
  const update = useUpdateHouseholdPresumedSalary();

  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [amountBRL, setAmountBRL] = useState("");
  const [amountUsd, setAmountUsd] = useState("");

  useEffect(() => {
    if (!data) return;
    setIsForeignCurrency(data.isForeignCurrency);
    setAmountBRL(data.amountBRL ?? "");
    setAmountUsd(data.amountUsd ?? "");
  }, [data]);

  const usdRate = quotes?.find((q) => q.symbol === "USD")?.rate ?? null;
  const parsedUsd = parseAmountInput(amountUsd);
  const livePreviewBrl = usdRate && !Number.isNaN(parsedUsd) ? parsedUsd * usdRate : null;
  const parsedBRL = parseAmountInput(amountBRL);
  const canSave = isForeignCurrency ? !Number.isNaN(parsedUsd) : !Number.isNaN(parsedBRL);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    if (isForeignCurrency) update.mutate({ isForeignCurrency: true, amountUsd: parsedUsd });
    else update.mutate({ isForeignCurrency: false, amountBRL: parsedBRL });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Salário presumido</CardTitle>
          <p className="mt-1 text-xs text-muted">
            Usado como estimativa no Dashboard nos meses em que nenhuma entrada ainda foi lançada — o salário ainda não caiu.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl surface-2 p-3">
              <div>
                <p className="text-sm font-medium">Recebido em dólar?</p>
                <p className="text-xs text-muted">Converte pra reais ao vivo, pela cotação do momento, toda vez que a estimativa for usada.</p>
              </div>
              <input
                type="checkbox"
                checked={isForeignCurrency}
                onChange={(e) => setIsForeignCurrency(e.target.checked)}
                className="h-5 w-5 shrink-0 rounded accent-accent-500"
              />
            </label>

            {isForeignCurrency ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Valor mensal (US$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] surface px-3 text-sm outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                />
                <p className="text-xs text-muted">
                  {usdRate && livePreviewBrl !== null
                    ? `≈ ${formatCurrency(livePreviewBrl)} pela cotação atual (US$ 1 = ${formatCurrency(usdRate)})`
                    : "Cotação indisponível no momento."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Valor mensal (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountBRL}
                  onChange={(e) => setAmountBRL(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] surface px-3 text-sm outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={update.isPending} disabled={!canSave}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function Configuracoes() {
  const { data: billCategories, isLoading: loadingBillCats } = useHouseholdBillCategories();
  const createBillCat = useCreateHouseholdBillCategory();
  const deleteBillCat = useDeleteHouseholdBillCategory();
  const reorderBillCats = useReorderHouseholdBillCategories();

  const { data: incomeCategories, isLoading: loadingIncomeCats } = useHouseholdIncomeCategories();
  const createIncomeCat = useCreateHouseholdIncomeCategory();
  const deleteIncomeCat = useDeleteHouseholdIncomeCategory();
  const reorderIncomeCats = useReorderHouseholdIncomeCategories();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted">Categorias de contas e de entradas usadas no módulo Contas da Casa.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategorySection<HouseholdBillCategory>
          title="Categorias de contas"
          description="Usadas para organizar e agrupar as contas fixas no dashboard."
          categories={billCategories}
          isLoading={loadingBillCats}
          onCreate={(data) => createBillCat.mutate(data)}
          creating={createBillCat.isPending}
          onDelete={(id) => deleteBillCat.mutate(id)}
          onReorder={(ids) => reorderBillCats.mutate(ids)}
        />

        <CategorySection<HouseholdIncomeCategory>
          title="Categorias de entradas"
          description="Usadas para classificar salário, freelance, investimentos e outras receitas."
          categories={incomeCategories}
          isLoading={loadingIncomeCats}
          onCreate={(data) => createIncomeCat.mutate(data)}
          creating={createIncomeCat.isPending}
          onDelete={(id) => deleteIncomeCat.mutate(id)}
          onReorder={(ids) => reorderIncomeCats.mutate(ids)}
        />

        <PresumedSalaryCard />
      </div>
    </div>
  );
}
