import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Landmark, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { useMarketPurchase } from "../api";
import { TaxDisclaimer } from "../components/TaxDisclaimer";

export default function CompraDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: purchase, isLoading, isError } = useMarketPurchase(id);

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  if (isError || !purchase) {
    return (
      <EmptyState
        icon={<Receipt className="h-7 w-7" />}
        title="Compra não encontrada"
        description="Ela pode ter sido removida."
        action={
          <Link to="/mercado/compras" className="text-sm font-medium text-sky-500 hover:underline">
            Voltar pras compras
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/mercado/compras" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-[rgb(var(--text))]">
        <ArrowLeft className="h-4 w-4" />
        Compras
      </Link>

      <PageHeader title={purchase.storeName} description={formatDate(purchase.purchaseDate, { dateStyle: "full" })} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Total pago</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(purchase.totalAmount)}</p>
            <p className="mt-1 text-xs text-muted">
              {purchase.items.length} {purchase.items.length === 1 ? "item" : "itens"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Landmark className="h-3.5 w-3.5" />
              Tributos
            </p>
            {purchase.taxAmount === null ? (
              <>
                <p className="mt-1 text-2xl font-bold tracking-tight text-muted">—</p>
                <p className="mt-1 text-xs text-muted">Essa nota não declarou o valor.</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(purchase.taxAmount)}</p>
                <p className="mt-1 text-xs text-muted">
                  {((purchase.taxAmount / purchase.totalAmount) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do que
                  você pagou
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {purchase.taxAmount !== null && <TaxDisclaimer className="mb-4" />}

      <Card>
        <CardContent>
          <ul className="divide-y divide-[rgb(var(--border))]">
            {purchase.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Link to={`/mercado/produtos/${item.productId}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted">
                    {item.quantity.toLocaleString("pt-BR")} {item.unit} × {formatCurrency(item.unitPrice)}
                  </p>
                </Link>
                <span className="shrink-0 text-sm font-semibold">{formatCurrency(item.totalPrice)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {purchase.accessKey && <p className="mt-4 break-all text-center text-[11px] text-muted">Chave da nota: {purchase.accessKey}</p>}
    </div>
  );
}
