import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Coins,
  Percent,
  CalendarClock,
  ArrowUpRight,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { formatCurrency, formatDate } from "@/lib/format";
import { useInvestmentsDashboard, useRefreshInvestmentsDashboard } from "../api";
import { PatrimonyEvolutionChart } from "../components/PatrimonyEvolutionChart";
import { ResetPortfolioButton } from "../components/ResetPortfolioButton";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  STOCK: { label: "Ações", color: "#6D5BFF" },
  FII: { label: "FIIs", color: "#F59E0B" },
  CRYPTO: { label: "Criptomoedas", color: "#F97316" },
  FUND: { label: "Fundos", color: "#8B5CF6" },
  RENDA_FIXA: { label: "Renda Fixa", color: "#10B981" },
  CAIXA: { label: "Caixa", color: "#3B82F6" },
};

const ENTITY_LABEL: Record<string, string> = {
  InvestmentAsset: "Ativo",
  InvestmentTransaction: "Lançamento",
  InvestmentIncome: "Provento",
  InvestmentFixedIncome: "Renda Fixa",
  InvestmentCashAccount: "Conta",
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "cadastrado",
  UPDATE: "atualizado",
  DELETE: "removido",
  BUY: "compra registrada",
  SELL: "venda registrada",
  DIVIDEND: "provento recebido",
  APPLICATION: "aplicação registrada",
  REDEMPTION: "resgate registrado",
  INTEREST: "juros registrados",
};

export default function InvestmentsDashboard() {
  const { data, isLoading } = useInvestmentsDashboard();
  const refresh = useRefreshInvestmentsDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { cards, distribuicaoPorCategoria, ganhosPorCategoria, topGanhos, topPerdas, proximosVencimentos, ultimosLancamentos, evolucaoPatrimonial } = data;

  const isEmpty = cards.patrimonioTotal === 0 && distribuicaoPorCategoria.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <ResetPortfolioButton />
        </div>
        <EmptyState
          icon={<PiggyBank className="h-7 w-7" />}
          title="Sua carteira de investimentos está vazia"
          description="Cadastre uma aplicação de renda fixa, uma ação, FII ou criptomoeda para começar a acompanhar seu patrimônio."
        />
      </div>
    );
  }

  const categoryData = distribuicaoPorCategoria.map((d) => ({
    name: CATEGORY_META[d.category]?.label ?? d.category,
    color: CATEGORY_META[d.category]?.color ?? "#8B8B8B",
    total: d.total,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => refresh.mutate()} loading={refresh.isPending}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        <ResetPortfolioButton />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Patrimônio Total" value={formatCurrency(cards.patrimonioTotal)} icon={<Wallet className="h-4 w-4" />} delay={0} />
        <StatTile label="Valor Investido" value={formatCurrency(cards.valorInvestido)} icon={<Landmark className="h-4 w-4" />} delay={0.03} />
        <StatTile label="Valor Atual" value={formatCurrency(cards.valorAtual)} icon={<TrendingUp className="h-4 w-4" />} delay={0.06} />
        <StatTile
          label="Lucro Líquido"
          value={formatCurrency(cards.lucroLiquido)}
          icon={cards.lucroLiquido >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          tone={cards.lucroLiquido >= 0 ? "success" : "danger"}
          delay={0.09}
        />
        <StatTile
          label="Rentabilidade"
          value={`${cards.rentabilidadePercent.toFixed(2)}%`}
          icon={<Percent className="h-4 w-4" />}
          tone={cards.rentabilidadePercent >= 0 ? "success" : "danger"}
          delay={0.12}
        />
        <StatTile label="Dividendos Recebidos" value={formatCurrency(cards.dividendosRecebidos)} icon={<Coins className="h-4 w-4" />} delay={0.15} />
        <StatTile label="Juros Recebidos" value={formatCurrency(cards.jurosRecebidos)} icon={<Coins className="h-4 w-4" />} delay={0.18} />
        <StatTile label="Aportes do Mês" value={formatCurrency(cards.aportesDoMes)} icon={<ArrowUpRight className="h-4 w-4" />} delay={0.21} />
      </div>

      {ganhosPorCategoria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ganhos por categoria</CardTitle>
            <span className="text-xs text-muted">Realizado + não realizado + dividendos, desde o início</span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ganhosPorCategoria.map((g) => (
                <div key={g.category} className="rounded-xl surface-2 p-3">
                  <p className="text-xs text-muted">{CATEGORY_META[g.category]?.label ?? g.category}</p>
                  <p className={`text-lg font-bold ${g.total >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatCurrency(g.total)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Inclui os dividendos/proventos recebidos de cada ativo, não só a valorização do preço. Uma renda
              fixa já resgatada continua contando aqui, mesmo sem nenhuma aplicação ativa agora — o rendimento que
              ela já rendeu não desaparece só porque o dinheiro foi resgatado ou reinvestido.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução patrimonial</CardTitle>
            <span className="text-xs text-muted">Hoje: {formatCurrency(evolucaoPatrimonial.currentPatrimony)}</span>
          </CardHeader>
          <CardContent>
            {evolucaoPatrimonial.series.every((s) => s.capitalInvestido === 0) ? (
              <p className="py-10 text-center text-sm text-muted">Sem histórico suficiente ainda.</p>
            ) : (
              <PatrimonyEvolutionChart data={evolucaoPatrimonial.series} />
            )}
            <p className="mt-2 text-xs text-muted">
              Mostra o capital acumulado investido (aportes líquidos) mês a mês — não é uma reconstrução do valor de
              mercado histórico.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? <p className="py-10 text-center text-sm text-muted">Sem dados ainda.</p> : <CategoryChart data={categoryData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Maiores ganhos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topGanhos.length === 0 && <p className="text-sm text-muted">Nenhum resultado ainda.</p>}
            {topGanhos.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(item.profit)} ({item.profitPercent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maiores perdas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerdas.length === 0 && <p className="text-sm text-muted">Nenhum resultado ainda.</p>}
            {topPerdas.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className={`font-semibold ${item.profit < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                  {formatCurrency(item.profit)} ({item.profitPercent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proximosVencimentos.length === 0 && <p className="text-sm text-muted">Nenhum vencimento futuro.</p>}
            {proximosVencimentos.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted" />
                  <span className="font-medium">{item.institution}</span>
                  <span className="text-xs text-muted">{item.type}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(item.netValue)}</p>
                  <p className="text-xs text-muted">{formatDate(item.maturityDate)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos lançamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ultimosLancamentos.length === 0 && <p className="text-sm text-muted">Nenhum lançamento ainda.</p>}
            {ultimosLancamentos.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{ENTITY_LABEL[log.entity] ?? log.entity}</span>{" "}
                  <span className="text-muted">{ACTION_LABEL[log.action] ?? log.action.toLowerCase()}</span>
                </span>
                <span className="text-xs text-muted">{formatDate(log.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
