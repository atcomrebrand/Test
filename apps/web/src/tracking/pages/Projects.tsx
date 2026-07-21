import { useState } from "react";
import { Plus, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTrackingProjects, useDeleteTrackingProject } from "../api";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { TrackingProject } from "../types";

const STATUS_LABEL: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_TONE_MAP: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  EM_ANDAMENTO: "accent",
  CONCLUIDO: "success",
  CANCELADO: "neutral",
};

export default function Projects() {
  const { data, isLoading } = useTrackingProjects();
  const remove = useDeleteTrackingProject();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<TrackingProject | null>(null);

  function openCreate() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function openEdit(project: TrackingProject) {
    setEditingProject(project);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Projetos Extras</h1>
          <p className="text-sm text-muted">Freelas e projetos avulsos — entram automaticamente no faturamento.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<FolderKanban className="h-7 w-7" />}
          title="Nenhum projeto extra cadastrado"
          description="Cadastre um freela ou projeto avulso pra contar no seu faturamento total."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar projeto
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.map((project) => {
          const hourlyRate = Number(project.amountReceived) / Number(project.hoursSpent);
          return (
            <Card key={project.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-sm text-muted">{project.client ?? "Sem cliente"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(project)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove.mutate(project.id)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted">Recebido</p>
                    <p className="font-semibold">{formatCurrency(project.amountReceived)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Horas</p>
                    <p className="font-semibold">{Number(project.hoursSpent)}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Valor/hora</p>
                    <p className="font-semibold">{formatCurrency(hourlyRate)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge tone={STATUS_TONE_MAP[project.status] ?? "neutral"}>{STATUS_LABEL[project.status]}</Badge>
                  <span className="text-xs text-muted">{formatDate(project.date)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ProjectFormModal open={formOpen} onClose={() => setFormOpen(false)} project={editingProject} />
    </div>
  );
}
