import { FormEvent, useState } from "react";
import { Plus, Tag, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useHouseholdBillCategories,
  useCreateHouseholdBillCategory,
  useDeleteHouseholdBillCategory,
  useReorderHouseholdBillCategories,
  useHouseholdIncomeCategories,
  useCreateHouseholdIncomeCategory,
  useDeleteHouseholdIncomeCategory,
  useReorderHouseholdIncomeCategories,
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
      </div>
    </div>
  );
}
