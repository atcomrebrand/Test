import { FormEvent, useState } from "react";
import { Plus, Tag, Trash2, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/features/useCategories";

const COLORS = ["#22C55E", "#F97316", "#3B82F6", "#06B6D4", "#A855F7", "#EF4444", "#EC4899", "#EAB308", "#14B8A6", "#8B5CF6", "#6B7280"];

export default function Categories() {
  const { data: categories, isLoading } = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, color, icon: "tag" },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
        },
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Organize suas compras por categoria."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories?.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-2xl surface border border-[rgb(var(--border))] p-3.5 shadow-soft"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: cat.color }}
              >
                <Tag className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate text-sm font-medium">{cat.name}</span>
              {cat.isDefault ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Categoria padrão" />
              ) : (
                <button
                  onClick={() => confirm(`Excluir categoria "${cat.name}"?`) && remove.mutate(cat.id)}
                  className="rounded-lg p-1.5 transition-colors hover:surface-2"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova categoria">
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
            <Button type="submit" loading={create.isPending}>
              Criar categoria
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
