import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { useMarketProduct } from "../api";
import { PriceHistoryChart } from "../components/PriceHistoryChart";

export default function ProdutoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useMarketProduct(id);

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  if (isError || !product) {
    return (
      <EmptyState
        icon={<Package className="h-7 w-7" />}
        title="Produto não encontrado"
        action={
          <Link to="/mercado/produtos" className="text-sm font-medium text-sky-500 hover:underline">
            Voltar pros produtos
          </Link>
        }
      />
    );
  }

  const summary = product.summary;
  const change = summary?.changePercent ?? null;
  const historico = [...product.history].reverse();

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/mercado/produtos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-[rgb(var(--text))]">
        <ArrowLeft className="h-4 w-4" />
        Produtos
      </Link>

      <PageHeader
        title={product.name}
        description={summary ? `${summary.timesBought} ${summary.timesBought === 1 ? "compra" : "compras"} · ${formatCurrency(summary.totalSpent)} no total` : undefined}
      />

      {summary && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Último preço</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(summary.lastPrice)}</p>
                <p className="text-xs text-muted">por {product.unit}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Variação</p>
                {change === null ? (
                  <>
                    <p className="mt-1 text-xl font-bold text-muted">—</p>
                    <p className="text-xs text-muted">Precisa de uma 2ª compra</p>
                  </>
                ) : (
                  <>
                    <p className={`mt-1 text-xl font-bold ${change > 0 ? "text-red-500" : change < 0 ? "text-emerald-500" : ""}`}>
                      {change > 0 ? "+" : ""}
                      {formatPercent(change)}
                    </p>
                    <p className="text-xs text-muted">desde {formatCurrency(summary.firstPrice)}</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                {/* Weighted by quantity, so a big shop doesn't count the same as a single unit. */}
                <p className="text-sm text-muted">Preço médio</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(summary.averagePrice)}</p>
                <p className="text-xs text-muted">
                  {formatCurrency(summary.minPrice)} – {formatCurrency(summary.maxPrice)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Store className="h-3.5 w-3.5" />
                  Mais barato em
                </p>
                <p className="mt-1 truncate text-base font-semibold">{summary.cheapestStore ?? "—"}</p>
              </CardContent>
            </Card>
          </div>

          {product.history.length > 1 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Preço por {product.unit} ao longo do tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceHistoryChart history={product.history} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cada vez que você comprou</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-[rgb(var(--border))]">
            {historico.map((point, index) => {
              const ehMaisBarato = summary !== null && point.unitPrice === summary.minPrice;
              return (
                <li key={`${point.purchaseDate}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{point.storeName}</p>
                    <p className="text-xs text-muted">
                      {formatDate(point.purchaseDate)} · {point.quantity.toLocaleString("pt-BR")} {product.unit}
                    </p>
                  </div>
                  {ehMaisBarato && <Badge tone="success">menor preço</Badge>}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatCurrency(point.unitPrice)}</p>
                    <p className="text-xs text-muted">{formatCurrency(point.totalPrice)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
