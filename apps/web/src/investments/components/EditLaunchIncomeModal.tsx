import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUpdateLaunchIncome } from "../api";
import { LaunchIncome } from "../types";

interface Props {
  income: LaunchIncome | null;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: "DIVIDENDO", label: "Dividendo" },
  { value: "JCP", label: "JCP" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "STAKING", label: "Staking" },
  { value: "OUTRO", label: "Outro" },
];

export function EditLaunchIncomeModal({ income, onClose }: Props) {
  const update = useUpdateLaunchIncome();
  const [type, setType] = useState("DIVIDENDO");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  useEffect(() => {
    if (!income) return;
    setType(income.type);
    setAmount(income.amount);
    setPaymentDate(income.paymentDate.slice(0, 10));
  }, [income]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!income) return;
    update.mutate(
      { id: income.id, data: { type, amount: Number(amount), paymentDate: new Date(paymentDate + "T12:00:00").toISOString() } },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={!!income} onClose={onClose} title={income ? `Editar provento — ${income.asset?.ticker ?? ""}` : ""}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Select label="Tipo" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        <Input label="Valor (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <Input label="Data" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
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
