import { FormEvent, useEffect, useState } from "react";
import { TrendingDown, TrendingUp, Minus, Trophy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUpdatePayoff, useFinancingPayoffQuotes, PayoffComparison } from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
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
  const { data: quotes, isLoading: quotesLoading } = useFinancingPayoffQuotes(open ? (financing?.id ?? null) : null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [comparison, setComparison] = useState<PayoffComparison | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(financing?.payoffAmount ? String(financing.payoffAmount) : "");
      setDate(todayISO());
      setComparison(null);
    }
    // Only reset when the modal opens — `financing`'s reference changes on every background
    // refetch (e.g. right after a successful save invalidates the query), which would otherwise
    // wipe the just-set comparison result before the user can see it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!financing) return;
    updatePayoff.mutate(
      { id: financing.id, payoffAmount: Number(amount), payoffQuotedAt: new Date(date + "T12:00:00").toISOString() },
      { onSuccess: (result) => setComparison(result.comparison) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Atualizar quitação à vista">
      {comparison ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl surface-2 p-4">
            <p className="text-sm text-muted">Nova proposta registrada</p>
            <p className="text-2xl font-bold">{formatCurrency(Number(amount))}</p>
          </div>

          {comparison.previousAmount !== null && comparison.percentChange !== null && (
            <div
              className={`flex items-center gap-3 rounded-2xl p-4 text-sm ${
                comparison.percentChange < 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : comparison.percentChange > 0
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "surface-2 text-muted"
              }`}
            >
              {comparison.percentChange < 0 ? (
                <TrendingDown className="h-5 w-5 shrink-0" />
              ) : comparison.percentChange > 0 ? (
                <TrendingUp className="h-5 w-5 shrink-0" />
              ) : (
                <Minus className="h-5 w-5 shrink-0" />
              )}
              <span>
                {comparison.percentChange === 0
                  ? "Mesmo valor da última proposta"
                  : `${Math.abs(comparison.percentChange).toFixed(1)}% ${comparison.percentChange < 0 ? "menor" : "maior"} que a última proposta`}{" "}
                ({formatCurrency(comparison.previousAmount)}).
              </span>
            </div>
          )}

          {comparison.isBestInWindow ? (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
              <Trophy className="h-5 w-5 shrink-0" />
              <span>Essa é a melhor proposta dos últimos {comparison.windowMonths} meses!</span>
            </div>
          ) : (
            comparison.bestInWindowAmount !== null && (
              <p className="text-sm text-muted">
                Não é a melhor dos últimos {comparison.windowMonths} meses — a menor foi{" "}
                {formatCurrency(comparison.bestInWindowAmount)}.
              </p>
            )
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
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
      )}

      {(quotesLoading || (quotes && quotes.length > 0)) && (
        <div className="mt-6 border-t border-[rgb(var(--border))] pt-4">
          <p className="mb-2 text-sm font-medium">Histórico de propostas</p>
          {quotesLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {quotes!.map((q, i) => (
                <div key={`${q.quotedAt}-${i}`} className="flex items-center justify-between rounded-xl surface-2 px-3 py-2 text-sm">
                  <span className="text-muted">{formatDate(q.quotedAt)}</span>
                  <span className="font-semibold">{formatCurrency(q.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
