import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUpdatePayoff } from "@/features/useFinancings";
import { Financing } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  financing: Financing | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PayoffQuoteModal({ open, onClose, financing }: Props) {
  const updatePayoff = useUpdatePayoff();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (open) {
      setAmount(financing?.payoffAmount ? String(financing.payoffAmount) : "");
      setDate(todayISO());
    }
  }, [open, financing]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!financing) return;
    updatePayoff.mutate(
      { id: financing.id, payoffAmount: Number(amount), payoffQuotedAt: new Date(date + "T12:00:00").toISOString() },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Atualizar quitação à vista">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Toda vez que o banco/financeira te mandar uma proposta nova de quitação, atualize aqui pra acompanhar a
          evolução.
        </p>
        <Input
          label="Valor da quitação (R$)"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          required
        />
        <Input label="Data da proposta" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={updatePayoff.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
