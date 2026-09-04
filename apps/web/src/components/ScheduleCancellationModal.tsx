import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useScheduleCancellation } from "@/features/usePurchases";
import { Purchase } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  subscription: Purchase | null;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ScheduleCancellationModal({ open, onClose, subscription }: Props) {
  const [date, setDate] = useState(tomorrowISO());
  const schedule = useScheduleCancellation();

  if (!subscription) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    schedule.mutate(
      { id: subscription!.id, recurrenceEndDate: new Date(date + "T12:00:00").toISOString() },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Planejar cancelamento" size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-[rgb(var(--text))]">{subscription.name}</span> continua cobrando
          normalmente até a data escolhida — as cobranças depois dela são removidas automaticamente.
        </p>
        <Input
          label="Cancelar a partir de"
          type="date"
          min={tomorrowISO()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          hint="Ex: se você quer aproveitar a cobrança deste mês e cancelar depois, escolha uma data no mês que vem."
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" loading={schedule.isPending}>
            Planejar cancelamento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
