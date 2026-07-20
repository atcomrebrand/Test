import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Coins, Percent, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAsset, useAssetQuoteDetail, useRefreshAssetQuote, useToggleFavorite } from "../api";
import { QuoteDetailCard } from "../components/QuoteDetailCard";
import { TransactionModal } from "../components/TransactionModal";
import { AssetIncomeModal } from "../components/AssetIncomeModal";
import { StakingConfigModal } from "../components/StakingConfigModal";

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: asset, isLoading: assetLoading } = useAsset(id ?? null);
  const { data: quote, isLoading: quoteLoading } = useAssetQuoteDetail(id ?? null);
  const refresh = useRefreshAssetQuote(id ?? null);
  const toggleFavorite = useToggleFavorite();

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [stakingOpen, setStakingOpen] = useState(false);

  if (assetLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/investimentos/carteira" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-[rgb(var(--text))]">
        <ArrowLeft className="h-4 w-4" />
        Voltar pra carteira
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{asset.ticker}</h1>
            <Badge tone="neutral">{asset.class}</Badge>
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
          </div>
          {asset.name && <p className="text-sm text-muted">{asset.name}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {asset.broker && <Badge tone="neutral">{asset.broker}</Badge>}
            {asset.wallet && <Badge tone="neutral">{asset.wallet}</Badge>}
            {asset.network && <Badge tone="neutral">{asset.network}</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setTransactionOpen(true)}>
            <ArrowLeftRight className="h-4 w-4" />
            Compra/Venda
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIncomeOpen(true)}>
            <Coins className="h-4 w-4" />
            Provento
          </Button>
          {asset.class === "CRYPTO" && (
            <Button variant="outline" size="sm" onClick={() => setStakingOpen(true)}>
              <Percent className="h-4 w-4" />
              Staking
            </Button>
          )}
        </div>
      </div>

      <QuoteDetailCard detail={quote?.detail} isLoading={quoteLoading} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} />

      {asset.class === "CRYPTO" && (
        <Card>
          <CardHeader>
            <CardTitle>Staking</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setStakingOpen(true)}>
              <Pencil className="h-4 w-4" />
              {asset.stakingApyPercent ? "Editar" : "Configurar"}
            </Button>
          </CardHeader>
          <CardContent>
            {asset.staking ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Taxa configurada: <span className="font-semibold text-[rgb(var(--text))]">{asset.staking.apyPercent}% a.a.</span> — cada
                  corretora paga uma taxa diferente, então ajuste aqui pra bater com a sua.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl surface-2 p-3">
                    <p className="text-xs text-muted">Desde</p>
                    <p className="font-semibold">{formatDate(asset.staking.sinceDate)}</p>
                  </div>
                  <div className="rounded-xl surface-2 p-3">
                    <p className="text-xs text-muted">Dias acumulando</p>
                    <p className="font-semibold">{asset.staking.daysHeld}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-3">
                    <p className="text-xs text-muted">Rendimento estimado</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(asset.staking.estimatedYield)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Isso é uma estimativa (não entra no lucro nem no dashboard) — pra registrar um rendimento que você
                  recebeu de verdade, use o botão "Provento" e escolha o tipo "Staking".
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Sem taxa de staking configurada pra {asset.ticker}. Se você faz staking dessa moeda em alguma corretora,
                configure a taxa (APY) pra acompanhar o rendimento estimado aqui.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sua posição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <p className="text-xs text-muted">Valor atual{asset.priceIsApproximate ? " (aprox.)" : ""}</p>
              <p className="font-semibold">{asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}</p>
            </div>
          </div>
          {asset.priceIsApproximate && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Mercado fracionário não tem cotação própria — valor calculado com o preço do lote padrão.
            </p>
          )}
          {asset.profit !== null && (
            <div className={`mt-4 rounded-xl p-3 text-sm font-semibold ${asset.profit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
              {formatCurrency(asset.profit)} ({asset.profitPercent?.toFixed(2)}%)
            </div>
          )}
        </CardContent>
      </Card>

      {asset.transactions && asset.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lançamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {asset.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={t.type === "BUY" ? "success" : "danger"}>{t.type === "BUY" ? "Compra" : "Venda"}</Badge>
                  <span>
                    {t.quantity} × {formatCurrency(t.unitPrice)}
                  </span>
                </div>
                <span className="text-xs text-muted">{formatDate(t.transactionDate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <TransactionModal assetId={transactionOpen ? asset.id : null} onClose={() => setTransactionOpen(false)} />
      <AssetIncomeModal assetId={incomeOpen ? asset.id : null} onClose={() => setIncomeOpen(false)} />
      <StakingConfigModal asset={stakingOpen ? asset : null} onClose={() => setStakingOpen(false)} />
    </div>
  );
}
