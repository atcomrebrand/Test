import { useState } from "react";
import { Plus, LineChart, Trash2, ArrowLeftRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { formatCurrency } from "@/lib/format";
import { useAssets, useDeleteAsset } from "../api";
import { AssetClass } from "../types";
import { AssetFormModal } from "../components/AssetFormModal";
import { TransactionModal } from "../components/TransactionModal";
import { AssetIncomeModal } from "../components/AssetIncomeModal";

const TAB_OPTIONS = [
  { value: "STOCK", label: "Ações" },
  { value: "FII", label: "FIIs" },
  { value: "CRYPTO", label: "Criptomoedas" },
];

const TAB_EMPTY_LABEL: Record<AssetClass, string> = {
  STOCK: "ação",
  FII: "FII",
  CRYPTO: "criptomoeda",
};

export default function Portfolio() {
  const [tab, setTab] = useState<AssetClass>("STOCK");
  const { data, isLoading } = useAssets(tab);
  const remove = useDeleteAsset();

  const [formOpen, setFormOpen] = useState(false);
  const [transactionTarget, setTransactionTarget] = useState<string | null>(null);
  const [incomeTarget, setIncomeTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Carteira</h1>
          <p className="text-sm text-muted">Ações, FIIs e criptomoedas com preço médio calculado automaticamente.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo ativo
        </Button>
      </div>

      <Tabs value={tab} onChange={(v) => setTab(v as AssetClass)} options={TAB_OPTIONS} />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<LineChart className="h-7 w-7" />}
          title={`Nenhuma ${TAB_EMPTY_LABEL[tab]} cadastrada`}
          description="Cadastre o ativo e depois registre as compras/vendas para o sistema calcular preço médio, lucro e rentabilidade automaticamente."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Cadastrar
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((asset) => (
          <Card key={asset.id}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{asset.ticker}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {asset.broker && <Badge tone="neutral">{asset.broker}</Badge>}
                    {asset.wallet && <Badge tone="neutral">{asset.wallet}</Badge>}
                  </div>
                </div>
                <button
                  onClick={() => remove.mutate(asset.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Quantidade</p>
                  <p className="font-semibold">{asset.position.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Preço médio</p>
                  <p className="font-semibold">{formatCurrency(asset.position.averagePrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Valor investido</p>
                  <p className="font-semibold">{formatCurrency(asset.position.investedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Valor atual</p>
                  <p className="font-semibold">{asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}</p>
                </div>
              </div>

              {asset.profit !== null && (
                <div className={`rounded-xl p-3 text-sm font-semibold ${asset.profit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(asset.profit)} ({asset.profitPercent?.toFixed(2)}%)
                </div>
              )}

              {asset.dividendsReceived > 0 && (
                <p className="text-xs text-muted">
                  Proventos recebidos: <span className="font-medium text-[rgb(var(--text))]">{formatCurrency(asset.dividendsReceived)}</span>
                  {asset.dividendYield !== null && ` (DY ${asset.dividendYield.toFixed(2)}%)`}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setTransactionTarget(asset.id)}>
                  <ArrowLeftRight className="h-4 w-4" />
                  Compra/Venda
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIncomeTarget(asset.id)}>
                  <Coins className="h-4 w-4" />
                  Provento
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AssetFormModal open={formOpen} onClose={() => setFormOpen(false)} assetClass={tab} />
      <TransactionModal assetId={transactionTarget} onClose={() => setTransactionTarget(null)} />
      <AssetIncomeModal assetId={incomeTarget} onClose={() => setIncomeTarget(null)} />
    </div>
  );
}
