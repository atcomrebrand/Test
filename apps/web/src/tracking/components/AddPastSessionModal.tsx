import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateManualSession, useTrackingJobs } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pré-preenche a data, ex: quando aberto a partir de um dia clicado no Calendário. */
  initialDate?: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** "Sessão retroativa" — pra registrar um trabalho de um dia/horário que ficou de fora do
 *  cronômetro ao vivo (esqueceu de iniciar, ou lembrou só depois). Diferente do Modo Foco, cria a
 *  sessão já finalizada direto, com check-in/check-out escolhidos manualmente. */
export function AddPastSessionModal({ open, onClose, initialDate }: Props) {
  const { data: jobs } = useTrackingJobs();
  const activeJobs = (jobs ?? []).filter((j) => j.active);
  const create = useCreateManualSession();

  const [jobId, setJobId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setJobId(activeJobs[0]?.id ?? "");
    setDate(initialDate ?? todayISO());
    setStartTime("09:00");
    setEndTime("17:00");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    const checkIn = new Date(`${date}T${startTime}:00`).toISOString();
    const checkOut = new Date(`${date}T${endTime}:00`).toISOString();
    create.mutate({ jobId, checkIn, checkOut, notes: notes || undefined }, { onSuccess: onClose });
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar sessão retroativa" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">Registre um dia de trabalho que ficou de fora do cronômetro ao vivo.</p>

        <Select
          label="Trabalho"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          options={[{ value: "", label: "Selecione..." }, ...activeJobs.map((j) => ({ value: j.id, label: `${j.name} — ${j.company}` }))]}
          required
        />

        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} required />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Entrada" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          <Input label="Saída" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>

        <Textarea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!jobId}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
