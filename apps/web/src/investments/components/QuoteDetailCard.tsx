import { useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { AssetPriceChart } from "./AssetPriceChart";
import { AssetQuoteDetail, ChartRange, HistoricalPricePoint } from "../types";

interface Props {
  detail: AssetQuoteDetail | null | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  /** Chart history for the currently selected range — decoupled from detail.history so switching
   *  ranges doesn't need to re-fetch price/fundamentals. */
  history: HistoricalPricePoint[] | undefined;
  historyLoading: boolean;
  range: ChartRange;
  onRangeChange: (range: ChartRange, from?: string, to?: string) => void;
  customFrom?: string;
  customTo?: string;
}

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "12M", label: "12M" },
  { value: "MAX", label: "Máximo" },
];

function RangeSelector({ range, onRangeChange, customFrom, customTo }: Pick<Props, "range" | "onRangeChange" | "customFrom" | "customTo">) {
  const [customOpen, setCustomOpen] = useState(range === "CUSTOM");
  const [from, setFrom] = useState(customFrom ?? "");
  const [to, setTo] = useState(customTo ?? "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setCustomOpen(false);
              onRangeChange(opt.value);
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              range === opt.value && !customOpen ? "bg-emerald-500 text-white" : "surface-2 text-muted hover:text-[rgb(var(--text))]",
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
            range === "CUSTOM" ? "bg-emerald-500 text-white" : "surface-2 text-muted hover:text-[rgb(var(--text))]",
          )}
        >
          Personalizado
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            De
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg surface-2 px-2 py-1 text-sm text-[rgb(var(--text))]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Até
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg surface-2 px-2 py-1 text-sm text-[rgb(var(--text))]"
            />
          </label>
          <Button size="sm" disabled={!from || !to} onClick={() => onRangeChange("CUSTOM", from, to)}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
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
export function QuoteDetailCard({
  detail,
  isLoading,
  onRefresh,
  refreshing,
  history,
  historyLoading,
  range,
  onRangeChange,
  customFrom,
  customTo,
}: Props) {
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-3xl font-bold">{formatCurrency(detail.price, detail.currency)}</p>
                  {detail.approximate && (
                    <Badge tone="warning" className="gap-1">
                      <TriangleAlert className="h-3 w-3" />
                      Aproximado
                    </Badge>
                  )}
                </div>
                {detail.approximate && (
                  <p className="mt-1 max-w-sm text-xs text-amber-600 dark:text-amber-400">
                    Mercado fracionário não tem cotação própria disponível — preço baseado no lote padrão.
                  </p>
                )}
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

          {detail && (
            <div className="flex flex-col gap-3">
              <RangeSelector range={range} onRangeChange={onRangeChange} customFrom={customFrom} customTo={customTo} />
              {historyLoading ? (
                <Skeleton className="h-[280px] rounded-xl" />
              ) : history && history.length > 0 ? (
                <AssetPriceChart history={history} positive={positive} />
              ) : (
                <div className="flex h-[120px] items-center justify-center rounded-xl surface-2 text-sm text-muted">
                  Sem histórico disponível para o período selecionado.
                </div>
              )}
            </div>
          )}
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
