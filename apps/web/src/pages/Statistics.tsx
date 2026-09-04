import { BarChart3, TrendingDown, TrendingUp, Trophy, PieChart, Calendar, Wallet2, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStatistics } from "@/features/useDashboard";
import { formatCurrency } from "@/lib/format";

export default function Statistics() {
  const { data, isLoading } = useStatistics();

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Estatísticas" description="Entenda seus hábitos de consumo." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const s = data;

  return (
    <div>
      <PageHeader title="Estatísticas" description="Entenda seus hábitos de consumo." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total já pago" value={formatCurrency(s.totalPaid)} icon={<TrendingDown className="h-4 w-4" />} tone="success" />
        <StatTile label="Total restante" value={formatCurrency(s.totalRemaining)} icon={<TrendingUp className="h-4 w-4" />} delay={0.05} />
        <StatTile label="Gasto anual" value={formatCurrency(s.annualSpending)} icon={<Calendar className="h-4 w-4" />} delay={0.1} />
        <StatTile label="Média mensal" value={formatCurrency(s.monthlyAverage)} icon={<BarChart3 className="h-4 w-4" />} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Maior compra</CardTitle>
          </CardHeader>
          <CardContent>
            {s.biggestPurchase ? (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{s.biggestPurchase.name}</p>
                  <p className="text-sm text-muted">{s.biggestPurchase.card?.name}</p>
                </div>
                <p className="ml-auto text-lg font-bold">{formatCurrency(s.biggestPurchase.totalAmount)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma compra registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categoria que mais gastou</CardTitle>
          </CardHeader>
          <CardContent>
            {s.topCategory ? (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                  <PieChart className="h-5 w-5" />
                </span>
                <p className="font-semibold">{s.topCategory.name}</p>
                <p className="ml-auto text-lg font-bold">{formatCurrency(s.topCategory.total)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Sem dados suficientes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parcelado vs. à vista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <CreditCard className="h-4 w-4" /> Parcelado
              </span>
              <span className="font-semibold">{formatCurrency(s.installmentTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Wallet2 className="h-4 w-4" /> À vista
              </span>
              <span className="font-semibold">{formatCurrency(s.cashTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restante por cartão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.remainingByCard?.length === 0 && <p className="text-sm text-muted">Nenhum cartão ativo.</p>}
            {s.remainingByCard?.map((c: any) => (
              <div key={c.cardId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.cardName}
                </span>
                <span className="font-semibold">{formatCurrency(c.remaining)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
