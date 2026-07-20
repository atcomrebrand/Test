import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAddAssetIncome } from "../api";

interface Props {
  assetId: string | null;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: "DIVIDENDO", label: "Dividendo" },
  { value: "JCP", label: "JCP" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "OUTRO", label: "Outro" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AssetIncomeModal({ assetId, onClose }: Props) {
  const addIncome = useAddAssetIncome();
  const [type, setType] = useState("DIVIDENDO");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());

  function reset() {
    setType("DIVIDENDO");
    setAmount("");
    setPaymentDate(todayISO());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assetId) return;
    addIncome.mutate(
      { assetId, data: { type, amount: Number(amount), paymentDate: new Date(paymentDate + "T12:00:00").toISOString() } },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={!!assetId} onClose={onClose} title="Registrar provento">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Select label="Tipo" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        <Input label="Valor (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <Input label="Data" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={addIncome.isPending}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
