import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateTrackingProject, useUpdateTrackingProject } from "../api";
import { TrackingProject } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  project?: TrackingProject | null;
}

const STATUS_OPTIONS = [
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "CANCELADO", label: "Cancelado" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ProjectFormModal({ open, onClose, project }: Props) {
  const create = useCreateTrackingProject();
  const update = useUpdateTrackingProject();
  const isEditing = !!project;

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [date, setDate] = useState(todayISO());
  const [hoursSpent, setHoursSpent] = useState("");
  const [status, setStatus] = useState("CONCLUIDO");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setClient(project.client ?? "");
      setAmountReceived(project.amountReceived);
      setDate(project.date.slice(0, 10));
      setHoursSpent(project.hoursSpent);
      setStatus(project.status);
      setNotes(project.notes ?? "");
    } else {
      setName("");
      setClient("");
      setAmountReceived("");
      setDate(todayISO());
      setHoursSpent("");
      setStatus("CONCLUIDO");
      setNotes("");
    }
  }, [open, project]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      client: client || undefined,
      amountReceived: Number(amountReceived),
      date: new Date(date + "T12:00:00").toISOString(),
      hoursSpent: Number(hoursSpent),
      status,
      notes: notes || undefined,
    };

    if (isEditing && project) {
      update.mutate({ id: project.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const hourlyRate = Number(amountReceived) > 0 && Number(hoursSpent) > 0 ? Number(amountReceived) / Number(hoursSpent) : null;
  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar projeto" : "Novo projeto extra"} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome do projeto" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Input label="Cliente (opcional)" value={client} onChange={(e) => setClient(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Valor recebido (R$)"
            type="number"
            step="0.01"
            min="0"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            required
          />
          <Input label="Horas gastas" type="number" step="0.5" min="0" value={hoursSpent} onChange={(e) => setHoursSpent(e.target.value)} required />
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        {hourlyRate !== null && <p className="text-xs text-muted">Valor/hora deste projeto: R$ {hourlyRate.toFixed(2)}</p>}

        <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />

        <Textarea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
