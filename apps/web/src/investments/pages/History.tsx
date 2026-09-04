import { useState } from "react";
import { History as HistoryIcon, ShoppingCart, TrendingDown, Coins, PiggyBank, ArrowDownCircle, Wallet, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useInvestmentHistory } from "../api";

const ENTITY_LABEL: Record<string, string> = {
  InvestmentAsset: "Ativo",
  InvestmentTransaction: "Lançamento",
  InvestmentIncome: "Provento",
  InvestmentFixedIncome: "Renda Fixa",
  InvestmentCashAccount: "Conta",
};

const ACTION_META: Record<string, { label: string; icon: typeof ShoppingCart }> = {
  CREATE: { label: "cadastrado", icon: Pencil },
  UPDATE: { label: "atualizado", icon: Pencil },
  DELETE: { label: "removido", icon: Trash2 },
  BUY: { label: "compra registrada", icon: ShoppingCart },
  SELL: { label: "venda registrada", icon: TrendingDown },
  DIVIDEND: { label: "provento recebido", icon: Coins },
  APPLICATION: { label: "aplicação registrada", icon: PiggyBank },
  REDEMPTION: { label: "resgate registrado", icon: ArrowDownCircle },
  INTEREST: { label: "juros registrados", icon: Coins },
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function History() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInvestmentHistory(page);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<HistoryIcon className="h-7 w-7" />}
        title="Nenhum lançamento ainda"
        description="Toda operação — compra, venda, aplicação, resgate, provento — aparece aqui em ordem cronológica."
      />
    );
  }

  const groups = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const key = dayKey(item.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Histórico</h1>
        <p className="text-sm text-muted">Linha do tempo de tudo que aconteceu na sua carteira.</p>
      </div>

      <div className="relative flex flex-col gap-6 pl-4">
        <div className="absolute bottom-0 left-[7px] top-1 w-px bg-[rgb(var(--border))]" />
        {Array.from(groups.entries()).map(([day, items]) => (
          <div key={day} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-muted">{formatDate(day, { day: "2-digit", month: "long", year: "numeric" })}</p>
            {items.map((item) => {
              const meta = ACTION_META[item.action] ?? { label: item.action.toLowerCase(), icon: Wallet };
              const Icon = meta.icon;
              return (
                <div key={item.id} className="relative flex items-start gap-3">
                  <div className="relative z-10 -ml-4 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Icon className="h-2.5 w-2.5" />
                  </div>
                  <div className="flex flex-1 items-center justify-between rounded-xl surface-2 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{ENTITY_LABEL[item.entity] ?? item.entity}</span> <span className="text-muted">{meta.label}</span>
                    </span>
                    <span className="text-xs text-muted">{formatDate(item.createdAt, { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted">
            {page} / {data.pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
