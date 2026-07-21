import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateTrackingJob, useUpdateTrackingJob } from "../api";
import { TrackingCurrency, TrackingJob, TrackingJobType } from "../types";

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real (R$)" },
  { value: "USD", label: "Dólar (US$)" },
];

const TYPE_OPTIONS = [
  { value: "FIXO", label: "Fixo" },
  { value: "FREELANCE", label: "Freelance" },
];

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

  const [type, setType] = useState<TrackingJobType>("FIXO");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [client, setClient] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [totalAgreedValue, setTotalAgreedValue] = useState("");
  const [currency, setCurrency] = useState<TrackingCurrency>("BRL");
  const [expectedHoursPerDay, setExpectedHoursPerDay] = useState("8");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (job) {
      setType(job.type);
      setName(job.name);
      setCompany(job.company);
      setClient(job.client ?? "");
      setMonthlyValue(job.monthlyValue ?? "");
      setTotalAgreedValue(job.totalAgreedValue ?? "");
      setCurrency(job.currency);
      setExpectedHoursPerDay(String(job.expectedHoursPerDay));
      setStartDate(toDateInput(job.startDate));
      setEndDate(toDateInput(job.endDate));
      setPaymentMethod(job.paymentMethod ?? "");
      setPaymentDay(job.paymentDay ? String(job.paymentDay) : "");
      setColor(job.color);
      setWeekdays(job.weekdays);
      setNotes(job.notes ?? "");
    } else {
      setType("FIXO");
      setName("");
      setCompany("");
      setClient("");
      setMonthlyValue("");
      setTotalAgreedValue("");
      setCurrency("BRL");
      setExpectedHoursPerDay("8");
      setStartDate(todayISO());
      setEndDate("");
      setPaymentMethod("");
      setPaymentDay("");
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
      type,
      name,
      company: company || undefined,
      client: client || undefined,
      monthlyValue: type === "FIXO" ? Number(monthlyValue) : undefined,
      totalAgreedValue: type === "FREELANCE" ? Number(totalAgreedValue) : undefined,
      currency,
      expectedHoursPerDay: Number(expectedHoursPerDay),
      startDate: new Date(startDate + "T12:00:00").toISOString(),
      endDate: endDate ? new Date(endDate + "T12:00:00").toISOString() : undefined,
      paymentMethod: type === "FIXO" ? paymentMethod || undefined : undefined,
      paymentDay: type === "FIXO" && paymentDay ? Number(paymentDay) : undefined,
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar trabalho" : "Novo trabalho"} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Select
          label="Tipo"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(e) => setType(e.target.value as TrackingJobType)}
          disabled={isEditing}
          hint={isEditing ? "O tipo não pode ser alterado depois de criado." : "Fixo: salário mensal recorrente. Freelance: valor total combinado por projeto."}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Input
            label={type === "FREELANCE" ? "Empresa (opcional)" : "Empresa"}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required={type === "FIXO"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Cliente (opcional)" value={client} onChange={(e) => setClient(e.target.value)} />
          {type === "FIXO" && (
            <Input label="Forma de pagamento (opcional)" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Ex: PIX, transferência..." />
          )}
        </div>

        {type === "FIXO" && (
          <Input
            label="Dia do pagamento (opcional)"
            type="number"
            min="1"
            max="31"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            placeholder="Ex: 5"
            hint="Usado para calcular o 'próximo pagamento' no dashboard."
          />
        )}

        {type === "FIXO" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <Input
              label={`Valor mensal (${currency === "USD" ? "US$" : "R$"})`}
              type="number"
              step="0.01"
              min="0"
              value={monthlyValue}
              onChange={(e) => setMonthlyValue(e.target.value)}
              required
            />
            <Select label="Moeda" options={CURRENCY_OPTIONS} value={currency} onChange={(e) => setCurrency(e.target.value as TrackingCurrency)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <Input
              label={`Valor total combinado (${currency === "USD" ? "US$" : "R$"})`}
              type="number"
              step="0.01"
              min="0"
              value={totalAgreedValue}
              onChange={(e) => setTotalAgreedValue(e.target.value)}
              hint="O valor/hora é recalculado automaticamente: valor total ÷ horas cronometradas até agora."
              required
            />
            <Select label="Moeda" options={CURRENCY_OPTIONS} value={currency} onChange={(e) => setCurrency(e.target.value as TrackingCurrency)} />
          </div>
        )}
        {currency === "USD" && (
          <p className="-mt-2 text-xs text-muted">Convertido pra BRL em tempo real, pela cotação do dia, em toda estimativa e no dashboard.</p>
        )}

        {type === "FIXO" && (
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
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Data de início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Data de término (opcional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {type === "FIXO" && (
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
        )}

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
