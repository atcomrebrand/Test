import { FormEvent, useState } from "react";
import { Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { usePendingJobPayments, useConfirmJobPayment } from "../api";
import { TrackingPendingJobPayment } from "../types";

function PendingPaymentRow({ payment }: { payment: TrackingPendingJobPayment }) {
  // Só um chute inicial (o usuário sempre pode ajustar) — nunca o valor final, que é sempre em
  // reais: o que realmente cai na conta já vem convertido por quem paga, então pedir de novo em
  // USD e reconverter por cima só divergiria do que chegou de verdade.
  const [amount, setAmount] = useState(payment.suggestedAmountBRL !== null ? String(payment.suggestedAmountBRL) : "");
  const confirm = useConfirmJobPayment();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    confirm.mutate({ jobId: payment.jobId, amount: Number(amount) });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Hoje é dia de pagamento de <span className="font-semibold">{payment.jobName}</span> ({payment.company}
          {payment.currency === "USD" ? ", contrato em US$" : ""}).
        </p>
        <p className="text-xs text-muted">Quanto caiu na sua conta esse mês, em reais?</p>
      </div>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-32"
        aria-label={`Valor recebido de ${payment.jobName}, em reais`}
        placeholder="R$"
      />
      <Button type="submit" size="sm" loading={confirm.isPending}>
        Confirmar
      </Button>
    </form>
  );
}

/** Persistent banner (not a blocking modal) shown in Dashboard + Modo Foco from paymentDay onward
 *  until answered — "quanto você recebeu esse mês?" becomes the source of truth for that job's
 *  revenue that month, overriding the hours-based estimate (see computeFixedJobRevenue). */
export function PendingPaymentBanner() {
  const { data } = usePendingJobPayments();
  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 px-4 py-3">
      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
        <Wallet className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wide">Confirmação de pagamento</p>
      </div>
      <div className="flex flex-col gap-3 divide-y divide-violet-500/10">
        {data.map((payment, i) => (
          <div key={payment.jobId} className={i > 0 ? "pt-3" : undefined}>
            <PendingPaymentRow payment={payment} />
          </div>
        ))}
      </div>
    </div>
  );
}
