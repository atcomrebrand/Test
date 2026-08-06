import { useState } from "react";
import { Link } from "react-router-dom";
import { QrCode, ShoppingCart, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDeleteMarketPurchase, useMarketPurchases } from "../api";
import { MarketPurchaseSummary } from "../types";

export default function Compras() {
  const { data: purchases, isLoading } = useMarketPurchases();
  const remove = useDeleteMarketPurchase();
  const [target, setTarget] = useState<MarketPurchaseSummary | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Compras"
        description="Cada nota importada, com o que foi pago e quanto disso era imposto."
        actions={
          <Link to="/mercado/importar">
            <Button>
              <QrCode className="h-4 w-4" />
              Importar nota
            </Button>
          </Link>
        }
      />

      {(!purchases || purchases.length === 0) && (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="Nenhuma compra por aqui"
          description="Assim que você importar uma nota fiscal, ela aparece nessa lista."
          action={
            <Link to="/mercado/importar">
              <Button>Importar nota</Button>
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {purchases?.map((purchase) => (
          <Card key={purchase.id}>
            <CardContent className="flex items-center gap-3">
              <Link to={`/mercado/compras/${purchase.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{purchase.storeName}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {formatDate(purchase.purchaseDate)} · {purchase.itemCount} {purchase.itemCount === 1 ? "item" : "itens"}
                </p>
                {purchase.taxAmount !== null && (
                  <Badge tone="warning" className="mt-2">
                    {formatCurrency(purchase.taxAmount)} de tributos
                  </Badge>
                )}
              </Link>
              <span className="shrink-0 text-lg font-bold">{formatCurrency(purchase.totalAmount)}</span>
              <button
                onClick={() => setTarget(purchase)}
                className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label={`Remover compra em ${purchase.storeName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Naming the exact nota in the confirmation — store, date and amount — because the rows read
          alike when the same market is visited every week. */}
      <ConfirmModal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Remover essa compra?"
        description={
          target && (
            <>
              <strong className="text-[rgb(var(--text))]">{target.storeName}</strong> em {formatDate(target.purchaseDate)}, de{" "}
              {formatCurrency(target.totalAmount)} com {target.itemCount} {target.itemCount === 1 ? "item" : "itens"}. Os itens dela
              saem do histórico de preço dos produtos. Dá pra importar a nota de novo depois.
            </>
          )
        }
        confirmLabel="Remover"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setTarget(null) });
        }}
      />
    </div>
  );
}
