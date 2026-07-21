import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateTrackingJob, useUpdateTrackingJob } from "../api";
import { TrackingJob } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  job?: TrackingJob | null;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function JobFormModal({ open, onClose, job }: Props) {
  const create = useCreateTrackingJob();
  const update = useUpdateTrackingJob();
  const isEditing = !!job;

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [client, setClient] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [expectedHoursPerDay, setExpectedHoursPerDay] = useState("8");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (job) {
      setName(job.name);
      setCompany(job.company);
      setClient(job.client ?? "");
      setMonthlyValue(job.monthlyValue);
      setExpectedHoursPerDay(String(job.expectedHoursPerDay));
      setStartDate(toDateInput(job.startDate));
      setEndDate(toDateInput(job.endDate));
      setPaymentMethod(job.paymentMethod ?? "");
      setColor(job.color);
      setWeekdays(job.weekdays);
      setNotes(job.notes ?? "");
    } else {
      setName("");
      setCompany("");
      setClient("");
      setMonthlyValue("");
      setExpectedHoursPerDay("8");
      setStartDate(todayISO());
      setEndDate("");
      setPaymentMethod("");
      setColor("#7C3AED");
      setWeekdays([1, 2, 3, 4, 5]);
      setNotes("");
    }
  }, [open, job]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      company,
      client: client || undefined,
      monthlyValue: Number(monthlyValue),
      expectedHoursPerDay: Number(expectedHoursPerDay),
      startDate: new Date(startDate + "T12:00:00").toISOString(),
      endDate: endDate ? new Date(endDate + "T12:00:00").toISOString() : undefined,
      paymentMethod: paymentMethod || undefined,
      color,
      weekdays,
      notes: notes || undefined,
    };

    if (isEditing && job) {
      update.mutate({ id: job.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar trabalho fixo" : "Novo trabalho fixo"} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Cliente (opcional)" value={client} onChange={(e) => setClient(e.target.value)} />
          <Input label="Forma de pagamento (opcional)" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Ex: PIX, transferência..." />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Valor mensal (R$)"
            type="number"
            step="0.01"
            min="0"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
            required
          />
          <Input
            label="Horas esperadas por dia"
            type="number"
            step="0.5"
            min="0.5"
            value={expectedHoursPerDay}
            onChange={(e) => setExpectedHoursPerDay(e.target.value)}
            hint="Usado para estimar o valor/hora antes de existir histórico de sessões."
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Data de início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Data de término (opcional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--text))]">Dias da semana trabalhados</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  weekdays.includes(day)
                    ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    : "border-[rgb(var(--border))] text-muted hover:surface-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[rgb(var(--text))]">Cor</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded-lg border border-[rgb(var(--border))]"
          />
        </div>

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
