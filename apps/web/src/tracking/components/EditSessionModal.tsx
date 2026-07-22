import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUpdateSessionManual } from "../api";
import { TrackingSession } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  session: TrackingSession | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toLocalDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Corrige as horas de uma sessão já registrada (check-in/check-out/observações) — o trabalho em
 *  si não é editável aqui, só o horário, já que o objetivo é consertar um lançamento errado. */
export function EditSessionModal({ open, onClose, session }: Props) {
  const update = useUpdateSessionManual();

  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setDate(toLocalDate(session.checkIn));
    setStartTime(toLocalTime(session.checkIn));
    setEndTime(session.checkOut ? toLocalTime(session.checkOut) : "17:00");
    setNotes(session.notes ?? "");
  }, [open, session]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const checkIn = new Date(`${date}T${startTime}:00`).toISOString();
    const checkOut = new Date(`${date}T${endTime}:00`).toISOString();
    update.mutate({ id: session.id, data: { checkIn, checkOut, notes: notes || undefined } }, { onSuccess: onClose });
  }

  if (!session) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar sessão" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {session.job.name} — {session.job.company}
        </p>

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
          <Button type="submit" loading={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
