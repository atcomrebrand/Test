import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAddFixedIncomeInterest } from "../api";

interface Props {
  fixedIncomeId: string | null;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AddInterestModal({ fixedIncomeId, onClose }: Props) {
  const addInterest = useAddFixedIncomeInterest();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fixedIncomeId) return;
    addInterest.mutate(
      { id: fixedIncomeId, data: { amount: Number(amount), paymentDate: new Date(paymentDate + "T12:00:00").toISOString() } },
      {
        onSuccess: () => {
          setAmount("");
          setPaymentDate(todayISO());
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={!!fixedIncomeId} onClose={onClose} title="Registrar juros recebidos">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Valor (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <Input label="Data" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={addInterest.isPending}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
