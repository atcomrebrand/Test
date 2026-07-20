import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { AssetPriceChart } from "./AssetPriceChart";
import { AssetQuoteDetail } from "../types";

interface Props {
  detail: AssetQuoteDetail | null | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

/** Live price + chart + fundamentals — shared between "Sua carteira" (AssetDetail) and
 *  "Explorar" (MarketAssetDetail), since browsing an asset's data doesn't require owning it. */
export function QuoteDetailCard({ detail, isLoading, onRefresh, refreshing }: Props) {
  const positive = (detail?.changePercent ?? 0) >= 0;

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
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
              <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
                <RefreshCw className="h-4 w-4" />
                Atualizar agora
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Cotação indisponível no momento — tente atualizar.</p>
              <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
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
    </>
  );
}
