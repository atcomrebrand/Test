import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPercent } from "@/lib/format";
import { AssetAnalysis, AssetIndicators } from "../../types";

function ratio(value: number | null) {
  return value !== null ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
}

const INDICATORS: { key: keyof AssetIndicators; label: string; format: (v: number | null) => string }[] = [
  { key: "peRatio", label: "P/L", format: ratio },
  { key: "priceToSales", label: "P/Receita (PSR)", format: ratio },
  { key: "priceToBook", label: "P/VP", format: ratio },
  { key: "dividendYield", label: "DY", format: formatPercent },
  { key: "payoutRatio", label: "Payout", format: formatPercent },
  { key: "netMargin", label: "Margem líquida", format: formatPercent },
  { key: "grossMargin", label: "Margem bruta", format: formatPercent },
  { key: "returnOnEquity", label: "ROE", format: formatPercent },
  { key: "returnOnAssets", label: "ROA", format: formatPercent },
  { key: "netDebtToEquity", label: "Dívida líquida / Patrimônio", format: ratio },
  { key: "currentRatio", label: "Liquidez corrente", format: ratio },
];

interface Props {
  analysis: AssetAnalysis | null | undefined;
  isLoading: boolean;
}

export function IndicatorsSection({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!analysis) {
    return <p className="py-6 text-center text-sm text-muted">Indicadores indisponíveis pra esse ativo no momento.</p>;
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {INDICATORS.map(({ key, label, format }) => (
          <div key={key} className="rounded-xl surface-2 p-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-sm font-semibold">{format(analysis.indicators[key])}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
