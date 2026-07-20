import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { QuoteDetailCard } from "../components/QuoteDetailCard";
import { AssetFormModal } from "../components/AssetFormModal";
import { useMarketHistory, useMarketQuoteDetail, useRefreshMarketQuoteDetail } from "../api";
import { AssetClass, ChartRange } from "../types";

export default function MarketAssetDetail() {
  const { class: assetClass, ticker } = useParams<{ class: string; ticker: string }>();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const normalizedClass = (assetClass ?? "STOCK") as AssetClass;
  const normalizedTicker = ticker ? decodeURIComponent(ticker) : null;

  const { data: market, isLoading } = useMarketQuoteDetail(normalizedClass, normalizedTicker);
  const refresh = useRefreshMarketQuoteDetail(normalizedClass, normalizedTicker);

  const [chartRange, setChartRange] = useState<{ range: ChartRange; from?: string; to?: string }>({ range: "3M" });
  const { data: history, isLoading: historyLoading } = useMarketHistory(normalizedClass, normalizedTicker, chartRange);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!market || !normalizedTicker) return null;

  const displayName = market.detail?.fundamentals["Nome"];

  return (
    <div className="flex flex-col gap-4">
      <Link to="/investimentos/explorar" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-[rgb(var(--text))]">
        <ArrowLeft className="h-4 w-4" />
        Voltar pra explorar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{market.ticker.toUpperCase()}</h1>
            <Badge tone="neutral">{market.class}</Badge>
          </div>
          {typeof displayName === "string" && <p className="text-sm text-muted">{displayName}</p>}
        </div>

        {market.ownedAssetId ? (
          <Button variant="secondary" onClick={() => navigate(`/investimentos/carteira/${market.ownedAssetId}`)}>
            <Wallet className="h-4 w-4" />
            Ver na minha carteira
          </Button>
        ) : (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar à carteira
          </Button>
        )}
      </div>

      <QuoteDetailCard
        detail={market.detail}
        isLoading={false}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
        history={history}
        historyLoading={historyLoading}
        range={chartRange.range}
        customFrom={chartRange.from}
        customTo={chartRange.to}
        onRangeChange={(range, from, to) => setChartRange({ range, from, to })}
      />

      <AssetFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        assetClass={normalizedClass}
        prefill={{ ticker: market.ticker, name: typeof displayName === "string" ? displayName : undefined }}
      />
    </div>
  );
}
