import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, ArrowLeftRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAsset, useAssetQuoteDetail, useRefreshAssetQuote } from "../api";
import { AssetPriceChart } from "../components/AssetPriceChart";
import { TransactionModal } from "../components/TransactionModal";
import { AssetIncomeModal } from "../components/AssetIncomeModal";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: asset, isLoading: assetLoading } = useAsset(id ?? null);
  const { data: quote, isLoading: quoteLoading } = useAssetQuoteDetail(id ?? null);
  const refresh = useRefreshAssetQuote(id ?? null);

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  if (assetLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!asset) return null;

  const detail = quote?.detail;
  const positive = (detail?.changePercent ?? 0) >= 0;

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
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {quoteLoading ? (
            <Skeleton className="h-16 w-64" />
          ) : detail ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold">{formatCurrency(detail.price, detail.currency)}</p>
                {detail.changePercent !== null && (
                  <p className={`mt-1 flex items-center gap-1 text-sm font-semibold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {detail.changePercent.toFixed(2)}%
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">Ao vivo · atualizado {timeAgo(detail.fetchedAt)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refresh.mutate()} loading={refresh.isPending}>
                <RefreshCw className="h-4 w-4" />
                Atualizar agora
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Cotação indisponível no momento — tente atualizar.</p>
              <Button variant="outline" size="sm" onClick={() => refresh.mutate()} loading={refresh.isPending}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {detail && detail.history.length > 0 && <AssetPriceChart history={detail.history} positive={positive} />}
        </CardContent>
      </Card>

      {detail && Object.keys(detail.fundamentals).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do ativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(detail.fundamentals).map(([label, value]) => (
                <div key={label} className="rounded-xl surface-2 p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm font-semibold">{typeof value === "number" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : value}</p>
                </div>
              ))}
            </div>
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
              <p className="text-xs text-muted">Valor atual</p>
              <p className="font-semibold">{asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}</p>
            </div>
          </div>
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
    </div>
  );
}
