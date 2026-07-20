import { useState } from "react";
import { Plus, PiggyBank, Trash2, ArrowDownCircle, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDeleteFixedIncome, useFixedIncomes, useRedeemFixedIncome } from "../api";
import { FixedIncomeFormModal } from "../components/FixedIncomeFormModal";
import { AddInterestModal } from "../components/AddInterestModal";

const INDEXER_LABEL: Record<string, string> = {
  PREFIXADO: "Prefixado",
  POS_FIXADO_CDI: "% CDI",
  IPCA_MAIS: "IPCA+",
  OUTRO: "Outro",
};

export default function FixedIncomePage() {
  const { data, isLoading } = useFixedIncomes();
  const redeem = useRedeemFixedIncome();
  const remove = useDeleteFixedIncome();
  const [formOpen, setFormOpen] = useState(false);
  const [interestTarget, setInterestTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Renda Fixa</h1>
          <p className="text-sm text-muted">CDB, LCI, LCA e Tesouro Direto — sempre com valor bruto e líquido lado a lado.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova aplicação
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<PiggyBank className="h-7 w-7" />}
          title="Nenhuma aplicação de renda fixa"
          description="Cadastre um CDB, LCI, LCA ou Tesouro Direto pra acompanhar valor bruto, líquido, IR e IOF automaticamente."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Cadastrar aplicação
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.map((f) => {
          const daysToMaturity = Math.ceil((new Date(f.maturityDate).getTime() - Date.now()) / 86400000);
          return (
            <Card key={f.id}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{f.institution}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="accent">{f.type}</Badge>
                      <Badge tone="neutral">{INDEXER_LABEL[f.indexer]}</Badge>
                      {f.redeemedAt && <Badge tone="success">Resgatado</Badge>}
                    </div>
                  </div>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-xl surface-2 p-3">
                  <div>
                    <p className="text-xs text-muted">Valor bruto</p>
                    <p className="text-lg font-bold">{formatCurrency(f.calculation.grossValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Valor líquido</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(f.calculation.netValue)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg surface-2 p-2">
                    <p className="text-muted">IR ({f.calculation.irRate}%)</p>
                    <p className="font-semibold">{formatCurrency(f.calculation.irAmount)}</p>
                  </div>
                  <div className="rounded-lg surface-2 p-2">
                    <p className="text-muted">IOF ({f.calculation.iofRate}%)</p>
                    <p className="font-semibold">{formatCurrency(f.calculation.iofAmount)}</p>
                  </div>
                  <div className="rounded-lg surface-2 p-2">
                    <p className="text-muted">Rent. líquida</p>
                    <p className="font-semibold">{f.calculation.netProfitabilityPercent.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Aplicado em {formatDate(f.applicationDate)}</span>
                  <span>
                    {f.redeemedAt
                      ? `Resgatado em ${formatDate(f.redeemedAt)}`
                      : daysToMaturity >= 0
                        ? `Vence em ${daysToMaturity} dias`
                        : "Vencido"}
                  </span>
                </div>

                {!f.redeemedAt && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setInterestTarget(f.id)}>
                      <Coins className="h-4 w-4" />
                      Registrar juros
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => redeem.mutate(f.id)} loading={redeem.isPending}>
                      <ArrowDownCircle className="h-4 w-4" />
                      Resgatar hoje
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FixedIncomeFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <AddInterestModal fixedIncomeId={interestTarget} onClose={() => setInterestTarget(null)} />
    </div>
  );
}
