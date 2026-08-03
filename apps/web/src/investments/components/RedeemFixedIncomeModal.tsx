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

/** Amount is optional — leaving it blank redeems the full principal (the original one-click
 *  behavior). Filling in less than the full principal does a partial redemption: that slice
 *  becomes its own redeemed record and the rest keeps accruing normally. */
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
  const principal = Number(fixedIncome.principalAmount);

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
          Valor aplicado: {formatCurrency(principal)}. Deixe o valor em branco pra resgatar tudo, ou informe um valor menor pra resgatar só uma
          parte — o restante continua rendendo normalmente.
        </p>
        <Input
          label="Valor a resgatar (R$) — opcional"
          type="number"
          step="0.01"
          min="0.01"
          max={principal}
          placeholder={`Deixar em branco = tudo (${formatCurrency(principal)})`}
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
