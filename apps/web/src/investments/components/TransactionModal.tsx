import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { useAddTransaction } from "../api";

interface Props {
  assetId: string | null;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionModal({ assetId, onClose }: Props) {
  const addTransaction = useAddTransaction();
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayISO());

  function reset() {
    setType("BUY");
    setQuantity("");
    setUnitPrice("");
    setFees("");
    setTransactionDate(todayISO());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assetId) return;
    addTransaction.mutate(
      {
        assetId,
        data: {
          type,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          fees: fees ? Number(fees) : 0,
          transactionDate: new Date(transactionDate + "T12:00:00").toISOString(),
        },
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={!!assetId} onClose={onClose} title="Registrar compra/venda">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Tabs value={type} onChange={(v) => setType(v as "BUY" | "SELL")} options={[{ value: "BUY", label: "Compra" }, { value: "SELL", label: "Venda" }]} />
        <Input label="Quantidade" type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
        <Input label="Preço unitário (R$)" type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
        <Input label="Taxas/corretagem (R$)" type="number" step="0.01" min="0" value={fees} onChange={(e) => setFees(e.target.value)} />
        <Input label="Data" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={addTransaction.isPending}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
