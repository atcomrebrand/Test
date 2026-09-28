import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import { AssetAnalysis, ProfitabilityPeriod } from "../../types";

const PROFITABILITY_LABELS: Record<ProfitabilityPeriod, string> = {
  "1M": "1 mês",
  "3M": "3 meses",
  "1A": "1 ano",
  "2A": "2 anos",
  "5A": "5 anos",
  "10A": "10 anos",
};

interface Props {
  analysis: AssetAnalysis | null | undefined;
  isLoading: boolean;
}

export function OverviewSection({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!analysis) {
    return <p className="py-6 text-center text-sm text-muted">Análise indisponível pra esse ativo no momento.</p>;
  }

  const { indicators, tip, graham, bazin, profitability, changePercent } = analysis;
  const changeUp = (changePercent ?? 0) >= 0;
  const oneYearUp = (profitability["1A"] ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Cotação" value={formatCurrency(analysis.currentPrice)} />
        <StatTile
          label="Variação (12 meses)"
          value={formatPercent(profitability["1A"])}
          icon={oneYearUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          tone={profitability["1A"] === null ? "default" : oneYearUp ? "success" : "danger"}
        />
        <StatTile label="P/L" value={indicators.peRatio !== null ? indicators.peRatio.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"} />
        <StatTile label="DY" value={formatPercent(indicators.dividendYield)} />
        <StatTile
          label="P/VP"
          value={indicators.priceToBook !== null ? indicators.priceToBook.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
        />
        <StatTile label="ROE" value={formatPercent(indicators.returnOnEquity)} />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <Lightbulb className="h-4 w-4" />
        </span>
        <p className="text-sm">
          {tip.amountIfInvested100OneYearAgo !== null ? (
            <>
              Se você tivesse investido <strong>R$ 100,00</strong> há 1 ano em {analysis.ticker}, hoje teria{" "}
              <strong className={oneYearUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                {formatCurrency(tip.amountIfInvested100OneYearAgo)}
              </strong>
              .
            </>
          ) : (
            "Ainda não temos um ano de histórico de preço pra estimar esse retorno."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rentabilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {(Object.keys(PROFITABILITY_LABELS) as ProfitabilityPeriod[]).map((period) => {
                const value = profitability[period];
                const up = (value ?? 0) >= 0;
                return (
                  <div key={period} className="rounded-xl surface-2 p-3 text-center">
                    <p className="text-xs text-muted">{PROFITABILITY_LABELS[period]}</p>
                    <p className={`mt-1 text-sm font-semibold ${value === null ? "text-muted" : up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatPercent(value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Preço justo de Graham</CardTitle>
            </CardHeader>
            <CardContent>
              {graham ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted">Preço atual</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(graham.currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Preço justo</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(graham.fairPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Upside</p>
                    <p className={`mt-1 text-sm font-semibold ${graham.upsidePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatPercent(graham.upsidePercent)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-muted">Não aplicável — precisa de LPA e VPA positivos.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teto de Bazin</CardTitle>
            </CardHeader>
            <CardContent>
              {bazin ? (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted">Preço atual</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(bazin.currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Preço teto</p>
                    <p className={`mt-1 text-sm font-semibold ${bazin.currentPrice <= bazin.ceilingPrice ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(bazin.ceilingPrice)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-muted">Não aplicável — sem histórico de dividendos suficiente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
