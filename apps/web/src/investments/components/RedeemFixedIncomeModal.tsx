import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import { useRedeemFixedIncome } from "../api";
import { InvestmentFixedIncome } from "../types";

interface Props {
  fixedIncome: InvestmentFixedIncome | null;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Amount is optional — leaving it blank redeems everything (the original one-click behavior).
 *  Filling in a value does a partial redemption: it's the net cash you want to receive today (what
 *  actually lands in the bank account), not a slice of the original principal — the backend works
 *  out how much principal needs to come out so the numbers match, and the rest keeps accruing. */
export function RedeemFixedIncomeModal({ fixedIncome, onClose }: Props) {
  const redeem = useRedeemFixedIncome();
  const [redeemedAt, setRedeemedAt] = useState(todayISO());
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (fixedIncome) {
      setRedeemedAt(todayISO());
      setAmount("");
    }
  }, [fixedIncome]);

  if (!fixedIncome) return null;
  const availableNet = Number(fixedIncome.calculation.netValue);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fixedIncome) return;
    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    redeem.mutate(
      { id: fixedIncome.id, redeemedAt: new Date(redeemedAt + "T12:00:00").toISOString(), amount: parsedAmount },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={!!fixedIncome} onClose={onClose} title="Resgatar aplicação">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Valor líquido disponível hoje: {formatCurrency(availableNet)}. Deixe o valor em branco pra resgatar tudo, ou informe quanto você quer
          receber na conta — o restante continua rendendo normalmente.
        </p>
        <Input
          label="Valor que você quer receber (R$) — opcional"
          type="number"
          step="0.01"
          min="0.01"
          max={availableNet}
          placeholder={`Deixar em branco = tudo (${formatCurrency(availableNet)})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input label="Data do resgate" type="date" value={redeemedAt} onChange={(e) => setRedeemedAt(e.target.value)} required />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={redeem.isPending}>
            Resgatar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
