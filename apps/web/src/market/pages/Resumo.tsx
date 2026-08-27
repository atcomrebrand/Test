import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Landmark, Package, QrCode, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, formatPercent, monthLabel } from "@/lib/format";
import { useMarketProducts, useMarketPurchases, useMarketSummary } from "../api";
import { SpendingByMonthChart } from "../components/SpendingByMonthChart";
import { TaxDisclaimer } from "../components/TaxDisclaimer";

/** "2026-08" → "Agosto de 2026". */
function labelOf(month: string): string {
  const [ano, mes] = month.split("-");
  return monthLabel(Number(mes), Number(ano));
}

export default function Resumo() {
  const { data: summary, isLoading } = useMarketSummary();
  const { data: purchases } = useMarketPurchases();
  const { data: products } = useMarketProducts();

  // `null` = "Tudo" (o histórico inteiro, que era o único jeito até agora). Nenhum mês vira uma
  // segunda consulta: o `byMonth` já vem na mesma resposta que monta o gráfico, então trocar de
  // mês é instantâneo.
  const [mes, setMes] = useState<string | null>(null);
  const meses = useMemo(() => [...(summary?.byMonth ?? [])].reverse(), [summary]);

  // O mês pedido pode não existir mais (a última nota daquele mês foi apagada) — aí a tela volta
  // pro histórico inteiro em vez de mostrar zeros que parecem um mês sem compra.
  const doMes = mes ? (summary?.byMonth.find((m) => m.month === mes) ?? null) : null;

  const recentes = (purchases ?? [])
    .filter((p) => !mes || p.purchaseDate.slice(0, 7) === mes)
    .slice(0, 5);
  const maisCaros = (products ?? []).filter((p) => p.summary && p.summary.changePercent !== null).sort((a, b) => (b.summary!.changePercent ?? 0) - (a.summary!.changePercent ?? 0));

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!summary || summary.purchaseCount === 0) {
    return (
      <>
        <PageHeader title="Mercado" description="Gasto de supermercado e histórico de preço, direto da nota fiscal." />
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="Nenhuma compra importada ainda"
          description="Escaneie o QR Code de uma nota fiscal de mercado. Os produtos entram sozinhos e o histórico de preço começa a se formar a partir da segunda compra."
          action={
            <Link to="/mercado/importar">
              <Button>
                <QrCode className="h-4 w-4" />
                Importar a primeira nota
              </Button>
            </Link>
          }
        />
      </>
    );
  }

  // Depois da guarda: `summary` existe daqui pra baixo, e os dois formatos têm exatamente os
  // mesmos campos — é o que deixa os cards não saberem se estão mostrando um mês ou tudo.
  const periodo = doMes ?? summary;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mercado"
        description="Gasto de supermercado e histórico de preço, direto da nota fiscal."
        actions={
          <Link to="/mercado/importar">
            <Button>
              <QrCode className="h-4 w-4" />
              Importar nota
            </Button>
          </Link>
        }
      />

      {/* Só aparece quando há mais de um mês pra escolher: com uma nota importada, um seletor de um
          item é ruído. */}
      {meses.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="periodo" className="text-sm text-muted">
            Período
          </label>
          <select
            id="periodo"
            value={mes ?? ""}
            onChange={(e) => setMes(e.target.value || null)}
            className="rounded-lg border border-[rgb(var(--border))] surface px-3 py-1.5 text-sm font-medium"
          >
            <option value="">Tudo ({meses.length} meses)</option>
            {/* Só os meses que tiveram compra: mês vazio não vira opção, senão a lista encheria de
                período que só pode mostrar zero. */}
            {meses.map((m) => (
              <option key={m.month} value={m.month}>
                {labelOf(m.month)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={doMes ? "Gasto no mês" : "Gasto total"}
          value={formatCurrency(periodo.totalSpent)}
          icon={<ShoppingCart className="h-4 w-4" />}
          sublabel={`${periodo.purchaseCount} ${periodo.purchaseCount === 1 ? "compra" : "compras"}`}
        />
        <StatTile
          label="Tributos"
          value={formatCurrency(periodo.totalTax)}
          icon={<Landmark className="h-4 w-4" />}
          tone="danger"
          // Saying which slice of the purchases this covers matters as much as the number: a total
          // built from 2 of 9 notas is a very different claim from one built from all 9.
          sublabel={
            periodo.purchasesWithTax === periodo.purchaseCount
              ? "Declarados em todas as notas"
              : `Declarados em ${periodo.purchasesWithTax} de ${periodo.purchaseCount} notas`
          }
          delay={0.05}
        />
        <StatTile
          label="Peso do imposto"
          value={formatPercent(periodo.taxSharePercent)}
          icon={<TrendingUp className="h-4 w-4" />}
          sublabel="Sobre as notas que declararam"
          delay={0.1}
        />
        {/* Era "Produtos" (a contagem do catálogo inteiro). Num painel que agora pode estar num mês
            só, um número de sempre no meio de três do mês se lê como sendo do mês também — e a
            média por compra responde algo do período, que é o que os outros três respondem. A
            contagem de produtos continua na tela de Produtos. */}
        <StatTile
          label="Média por compra"
          value={formatCurrency(periodo.purchaseCount > 0 ? periodo.totalSpent / periodo.purchaseCount : 0)}
          icon={<Package className="h-4 w-4" />}
          sublabel={`${products?.length ?? 0} produtos rastreados`}
          delay={0.15}
        />
      </div>

      <TaxDisclaimer />

      <Card>
        <CardHeader>
          <CardTitle>Gasto e tributos por mês</CardTitle>
        </CardHeader>
        <CardContent>
          {/* O histórico inteiro continua na tela mesmo com um mês escolhido — o gráfico É a
              comparação entre meses. O escolhido fica destacado, e clicar numa barra escolhe ela. */}
          <SpendingByMonthChart months={summary.byMonth} selected={doMes?.month ?? null} onSelect={setMes} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{doMes ? `Compras de ${labelOf(doMes.month)}` : "Últimas compras"}</CardTitle>
            <Link to="/mercado/compras" className="text-xs font-medium text-sky-500 hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-[rgb(var(--border))]">
            {recentes.map((purchase) => (
              <Link key={purchase.id} to={`/mercado/compras/${purchase.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{purchase.storeName}</p>
                  <p className="text-xs text-muted">
                    {formatDate(purchase.purchaseDate)} · {purchase.itemCount} itens
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{formatCurrency(purchase.totalAmount)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            {/* Sempre o histórico inteiro, mesmo com um mês escolhido: variação de preço se mede
                entre compras, e dentro de um mês costuma não haver duas do mesmo item. */}
            <CardTitle>O que mais subiu de preço</CardTitle>
            <Link to="/mercado/produtos" className="text-xs font-medium text-sky-500 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-[rgb(var(--border))]">
            {maisCaros.length === 0 && (
              <p className="py-3 text-sm text-muted">
                Nenhum produto tem duas compras ainda — a variação de preço aparece assim que você comprar o mesmo item de novo.
              </p>
            )}
            {maisCaros.slice(0, 5).map((product) => (
              <Link key={product.id} to={`/mercado/produtos/${product.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted">Agora {formatCurrency(product.summary!.lastPrice)}</p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${(product.summary!.changePercent ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {(product.summary!.changePercent ?? 0) > 0 ? "+" : ""}
                  {formatPercent(product.summary!.changePercent)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Receipt className="h-3.5 w-3.5" />
        Os dados vêm da consulta pública da SEFAZ-SP, a mesma página que abre ao escanear o QR Code da nota com a câmera do celular.
      </p>
    </div>
  );
}
