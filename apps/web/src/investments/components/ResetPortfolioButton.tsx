import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DangerConfirmModal } from "@/components/DangerConfirmModal";
import { useResetInvestments } from "../api";

/** Quick way to restart a test portfolio without recreating the account — wipes every investment
 *  record (assets, transactions, incomes, fixed income, contributions, cash accounts) but leaves
 *  login/preferences untouched. Meant to be temporary: remove once testing is done. */
export function ResetPortfolioButton() {
  const [open, setOpen] = useState(false);
  const reset = useResetInvestments();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0 text-red-600 dark:text-red-400">
        <RotateCcw className="h-3.5 w-3.5" />
        Zerar carteira
      </Button>
      <DangerConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title="Zerar carteira de investimentos"
        description="Isso apaga TODOS os ativos, negociações, proventos, aplicações de renda fixa, aportes e contas de caixa da carteira de investimentos. Não afeta seu login nem o restante do app. Ação irreversível — pensada só para facilitar testes."
        confirmWord="ZERAR"
        confirmLabel="Zerar carteira"
        loading={reset.isPending}
        onConfirm={() => reset.mutate(undefined, { onSuccess: () => setOpen(false) })}
      />
    </>
  );
}
