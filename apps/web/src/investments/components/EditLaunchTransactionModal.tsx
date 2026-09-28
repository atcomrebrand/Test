import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { useUpdateLaunchTransaction } from "../api";
import { LaunchTransaction } from "../types";

interface Props {
  transaction: LaunchTransaction | null;
  onClose: () => void;
}

export function EditLaunchTransactionModal({ transaction, onClose }: Props) {
  const update = useUpdateLaunchTransaction();
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [transactionDate, setTransactionDate] = useState("");

  useEffect(() => {
    if (!transaction) return;
    setType(transaction.type);
    setQuantity(transaction.quantity);
    setUnitPrice(transaction.unitPrice);
    setFees(transaction.fees);
    setTransactionDate(transaction.transactionDate.slice(0, 10));
  }, [transaction]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!transaction) return;
    update.mutate(
      {
        id: transaction.id,
        data: {
          type,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          fees: fees ? Number(fees) : 0,
          transactionDate: new Date(transactionDate + "T12:00:00").toISOString(),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={!!transaction} onClose={onClose} title={transaction ? `Editar negociação — ${transaction.asset.ticker}` : ""}>
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
          <Button type="submit" loading={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
