import { useState } from "react";
import { Plus, Briefcase, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { useTrackingJobs, useDeleteTrackingJob } from "../api";
import { JobFormModal } from "../components/JobFormModal";
import { TrackingJob } from "../types";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Jobs() {
  const { data, isLoading } = useTrackingJobs();
  const remove = useDeleteTrackingJob();
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<TrackingJob | null>(null);

  function openCreate() {
    setEditingJob(null);
    setFormOpen(true);
  }

  function openEdit(job: TrackingJob) {
    setEditingJob(job);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Trabalhos Fixos</h1>
          <p className="text-sm text-muted">Cadastre seus contratos fixos pra usar no Modo Foco.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo trabalho
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<Briefcase className="h-7 w-7" />}
          title="Nenhum trabalho fixo cadastrado"
          description="Cadastre seu contrato fixo pra começar a cronometrar suas horas no Modo Foco."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar trabalho
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.map((job) => (
          <Card key={job.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: job.color }} />
                  <div>
                    <p className="font-semibold">{job.name}</p>
                    <p className="text-sm text-muted">
                      {job.company}
                      {job.client ? ` · ${job.client}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(job)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove.mutate(job.id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Valor mensal</p>
                  <p className="font-semibold">{formatCurrency(job.monthlyValue, job.currency)}</p>
                  {job.currency === "USD" && (
                    <p className="text-xs text-muted">
                      {job.monthlyValueBRL !== null && job.monthlyValueBRL !== undefined
                        ? `≈ ${formatCurrency(job.monthlyValueBRL)} hoje`
                        : "cotação indisponível"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted">Valor estimado/hora</p>
                  <p className="font-semibold">{formatCurrency(job.estimatedHourlyRate ?? 0)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => (
                  <span
                    key={day}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      job.weekdays.includes(day) ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "text-muted"
                    }`}
                  >
                    {label}
                  </span>
                ))}
                {!job.active && <Badge tone="neutral">Inativo</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <JobFormModal open={formOpen} onClose={() => setFormOpen(false)} job={editingJob} />
    </div>
  );
}
