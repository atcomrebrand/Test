import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LineChart, Trash2, ArrowLeftRight, Coins, RefreshCw, Percent, Star, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useAssets,
  useDeleteAsset,
  useRefreshAssets,
  useToggleFavorite,
  useFixedIncomes,
  useDeleteFixedIncome,
  useRedeemFixedIncome,
} from "../api";
import { AssetClass, InvestmentAsset } from "../types";
import { AssetFormModal } from "../components/AssetFormModal";
import { TransactionModal } from "../components/TransactionModal";
import { AssetIncomeModal } from "../components/AssetIncomeModal";
import { StakingConfigModal } from "../components/StakingConfigModal";
import { YieldingIndicator } from "../components/YieldingIndicator";
import { FixedIncomeFormModal } from "../components/FixedIncomeFormModal";
import { AddInterestModal } from "../components/AddInterestModal";

type PortfolioTab = AssetClass | "RENDA_FIXA";

const TAB_OPTIONS = [
  { value: "STOCK", label: "Ações" },
  { value: "FII", label: "FIIs" },
  { value: "CRYPTO", label: "Criptomoedas" },
  { value: "RENDA_FIXA", label: "Renda Fixa" },
];

const TAB_EMPTY_LABEL: Record<AssetClass, string> = {
  STOCK: "ação",
  FII: "FII",
  CRYPTO: "criptomoeda",
};

const INDEXER_LABEL: Record<string, string> = {
  PREFIXADO: "Prefixado",
  POS_FIXADO_CDI: "% CDI",
  IPCA_MAIS: "IPCA+",
  OUTRO: "Outro",
};

export default function Portfolio() {
  const [tab, setTab] = useState<PortfolioTab>("STOCK");
  const isFixedIncome = tab === "RENDA_FIXA";

  const { data, isLoading } = useAssets(isFixedIncome ? undefined : tab, !isFixedIncome);
  const refreshPrices = useRefreshAssets(isFixedIncome ? undefined : tab);
  const remove = useDeleteAsset();
  const toggleFavorite = useToggleFavorite();

  const { data: fixedIncomes, isLoading: fixedIncomesLoading } = useFixedIncomes();
  const redeemFixedIncome = useRedeemFixedIncome();
  const removeFixedIncome = useDeleteFixedIncome();

  const [formOpen, setFormOpen] = useState(false);
  const [transactionTarget, setTransactionTarget] = useState<string | null>(null);
  const [incomeTarget, setIncomeTarget] = useState<string | null>(null);
  const [stakingTarget, setStakingTarget] = useState<InvestmentAsset | null>(null);
  const [interestTarget, setInterestTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Carteira</h1>
          <p className="text-sm text-muted">Ações, FIIs, criptomoedas e renda fixa, tudo em um só lugar.</p>
        </div>
        <div className="flex gap-2">
          {!isFixedIncome && (
            <Button variant="outline" onClick={() => refreshPrices.mutate()} loading={refreshPrices.isPending}>
              <RefreshCw className="h-4 w-4" />
              Atualizar preços
            </Button>
          )}
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {isFixedIncome ? "Nova aplicação" : "Novo ativo"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onChange={(v) => setTab(v as PortfolioTab)} options={TAB_OPTIONS} />

      {isFixedIncome ? (
        <>
          {fixedIncomesLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          )}

          {!fixedIncomesLoading && (!fixedIncomes || fixedIncomes.length === 0) && (
            <EmptyState
              icon={<LineChart className="h-7 w-7" />}
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
            {fixedIncomes?.map((f) => {
              const daysToMaturity = Math.ceil((new Date(f.maturityDate).getTime() - Date.now()) / 86400000);
              return (
                <Card key={f.id}>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{f.institution}</p>
                          {!f.redeemedAt && <YieldingIndicator />}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone="accent">{f.type}</Badge>
                          <Badge tone="neutral">{INDEXER_LABEL[f.indexer]}</Badge>
                          {f.redeemedAt && <Badge tone="success">Resgatado</Badge>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFixedIncome.mutate(f.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl surface-2 p-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Investido</p>
                        <p className="truncate text-sm font-bold">{formatCurrency(f.principalAmount)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Bruto</p>
                        <p className="truncate text-sm font-bold">{formatCurrency(f.calculation.grossValue)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Líquido</p>
                        <p className="truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(f.calculation.netValue)}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-3 text-sm font-semibold ${
                        f.calculation.netYield >= 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {f.calculation.netYield >= 0 ? "+" : "-"}
                      {formatCurrency(Math.abs(f.calculation.netYield))} ({f.calculation.netProfitabilityPercent.toFixed(2)}%)
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
                        <Button variant="outline" size="sm" onClick={() => redeemFixedIncome.mutate(f.id)} loading={redeemFixedIncome.isPending}>
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
        </>
      ) : (
        <>
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
              title={`Nenhuma ${TAB_EMPTY_LABEL[tab as AssetClass]} cadastrada`}
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
                    <Link to={`/investimentos/carteira/${asset.id}`} className="group">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{asset.ticker}</p>
                        {tab === "CRYPTO" && asset.staking && <YieldingIndicator />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {asset.broker && <Badge tone="neutral">{asset.broker}</Badge>}
                        {asset.wallet && <Badge tone="neutral">{asset.wallet}</Badge>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      {asset.currentPrice !== null && (
                        <span className="text-right text-xs">
                          <span className="block text-muted">{asset.priceIsApproximate ? "ao vivo (aprox.)" : "ao vivo"}</span>
                          <span className="font-semibold">{formatCurrency(asset.currentPrice)}</span>
                        </span>
                      )}
                      <button
                        onClick={() => toggleFavorite.mutate({ id: asset.id, favorite: !asset.favorite })}
                        className={cn(
                          "rounded-lg p-1.5 transition-colors hover:bg-amber-500/10",
                          asset.favorite ? "text-amber-500" : "text-muted hover:text-amber-500",
                        )}
                        aria-label={asset.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
                      >
                        <Star className="h-4 w-4" fill={asset.favorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => remove.mutate(asset.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

                  {tab === "CRYPTO" && asset.staking && (
                    <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <p className="font-semibold">
                        {asset.staking.stakingPercent}% da posição em staking a {asset.staking.apyPercent}% a.a.
                      </p>
                      <p>
                        Estimativa acumulada: {formatCurrency(asset.staking.estimatedYield)} ({asset.staking.daysHeld} dias)
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setTransactionTarget(asset.id)}>
                      <ArrowLeftRight className="h-4 w-4" />
                      Compra/Venda
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIncomeTarget(asset.id)}>
                      <Coins className="h-4 w-4" />
                      Provento
                    </Button>
                    {tab === "CRYPTO" && (
                      <Button variant="outline" size="sm" onClick={() => setStakingTarget(asset)}>
                        <Percent className="h-4 w-4" />
                        Staking
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {!isFixedIncome && <AssetFormModal open={formOpen} onClose={() => setFormOpen(false)} assetClass={tab as AssetClass} />}
      {isFixedIncome && <FixedIncomeFormModal open={formOpen} onClose={() => setFormOpen(false)} />}
      <TransactionModal assetId={transactionTarget} onClose={() => setTransactionTarget(null)} />
      <AssetIncomeModal assetId={incomeTarget} onClose={() => setIncomeTarget(null)} />
      <StakingConfigModal asset={stakingTarget} onClose={() => setStakingTarget(null)} />
      <AddInterestModal fixedIncomeId={interestTarget} onClose={() => setInterestTarget(null)} />
    </div>
  );
}
