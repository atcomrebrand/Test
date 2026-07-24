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
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [dayOffFrom, setDayOffFrom] = useState("");
  const [dayOffTo, setDayOffTo] = useState("");
  const [expectedStartTime, setExpectedStartTime] = useState("");
  const [expectedEndTime, setExpectedEndTime] = useState("");
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
      setDaysOff(job.daysOff);
      setDayOffFrom("");
      setDayOffTo("");
      setExpectedStartTime(job.expectedStartTime ?? "");
      setExpectedEndTime(job.expectedEndTime ?? "");
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
      setDaysOff([]);
      setDayOffFrom("");
      setDayOffTo("");
      setExpectedStartTime("");
      setExpectedEndTime("");
      setNotes("");
    }
  }, [open, job]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function addDaysOffRange() {
    if (!dayOffFrom) return;
    const to = dayOffTo || dayOffFrom;
    if (to < dayOffFrom) return;

    const dates: string[] = [];
    const cursor = new Date(dayOffFrom + "T12:00:00");
    const end = new Date(to + "T12:00:00");
    while (cursor <= end && dates.length < 366) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    setDaysOff((prev) => Array.from(new Set([...prev, ...dates])).sort());
    setDayOffFrom("");
    setDayOffTo("");
  }

  function removeDaysOffRange(start: string, end: string) {
    setDaysOff((prev) => prev.filter((d) => d < start || d > end));
  }

  /** Collapses consecutive dates into ranges for display, so a 2-week vacation shows as one chip
   *  instead of 14 — matches how it was most likely added (via the de/até range picker above). */
  function groupConsecutiveDaysOff(dates: string[]): { start: string; end: string }[] {
    const sorted = [...dates].sort();
    const groups: { start: string; end: string }[] = [];
    for (const d of sorted) {
      const last = groups[groups.length - 1];
      if (last) {
        const nextExpected = new Date(last.end + "T12:00:00");
        nextExpected.setDate(nextExpected.getDate() + 1);
        if (nextExpected.toISOString().slice(0, 10) === d) {
          last.end = d;
          continue;
        }
      }
      groups.push({ start: d, end: d });
    }
    return groups;
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
      daysOff: type === "FIXO" ? daysOff : [],
      expectedStartTime: type === "FIXO" ? expectedStartTime || null : null,
      expectedEndTime: type === "FIXO" ? expectedEndTime || null : null,
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

        {type === "FIXO" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--text))]">Dias de folga (opcional)</label>
            <p className="mb-2 text-xs text-muted">Sem lembrete de início/fim nessas datas — férias, feriados, licenças etc. Escolha um período (ou o mesmo dia em "de" e "até" pra um dia só).</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dayOffFrom}
                onChange={(e) => setDayOffFrom(e.target.value)}
                aria-label="De"
                className="rounded-lg border border-[rgb(var(--border))] bg-transparent px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-muted">até</span>
              <input
                type="date"
                value={dayOffTo}
                min={dayOffFrom || undefined}
                onChange={(e) => setDayOffTo(e.target.value)}
                aria-label="Até"
                className="rounded-lg border border-[rgb(var(--border))] bg-transparent px-3 py-1.5 text-sm"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addDaysOffRange} disabled={!dayOffFrom}>
                Adicionar
              </Button>
            </div>
            {daysOff.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {groupConsecutiveDaysOff(daysOff).map(({ start, end }) => (
                  <span
                    key={start}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-2.5 py-1 text-xs font-medium text-muted"
                  >
                    {start === end
                      ? new Date(start + "T12:00:00").toLocaleDateString("pt-BR")
                      : `${new Date(start + "T12:00:00").toLocaleDateString("pt-BR")} – ${new Date(end + "T12:00:00").toLocaleDateString("pt-BR")}`}
                    <button
                      type="button"
                      onClick={() => removeDaysOffRange(start, end)}
                      aria-label={`Remover folga de ${start} até ${end}`}
                      className="text-muted hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {type === "FIXO" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Horário de início (opcional)"
              type="time"
              value={expectedStartTime}
              onChange={(e) => setExpectedStartTime(e.target.value)}
              hint="Manda um lembrete pra iniciar o timer nesse horário, se ainda não tiver começado."
            />
            <Input
              label="Horário de término (opcional)"
              type="time"
              value={expectedEndTime}
              onChange={(e) => setExpectedEndTime(e.target.value)}
              hint="Sem isso, o lembrete de encerrar usa as horas esperadas por dia."
            />
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
