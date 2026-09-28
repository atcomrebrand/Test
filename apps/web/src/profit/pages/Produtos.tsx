import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { useProfitProducts } from "../api";
import { ProdutoModal } from "../components/ProdutoModal";
import { formatPercent, toneForProfit } from "../theme";

export default function Produtos() {
  const { data, isLoading } = useProfitProducts();
  const [criando, setCriando] = useState(false);

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Produtos"
        description="O que você vende, com o melhor canal de cada um já resolvido."
        actions={
          <Button onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Novo produto
          </Button>
        }
      />

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto cadastrado"
          description="Cadastre um produto e defina o preço em cada canal pra comparar onde compensa vender."
          action={<Button onClick={() => setCriando(true)}>Cadastrar o primeiro</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.map((p) => (
            <Link key={p.id} to={`/lucro/produtos/${p.id}`}>
              <Card className="h-full transition-colors hover:border-teal-500/40">
                <CardContent className="flex flex-col gap-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.sku ? `${p.sku} · ` : ""}custo {formatCurrency(p.cost + p.packagingCost + p.extraCost)}
                      </p>
                    </div>
                  </div>

                  {/* Sem preço definido em canal nenhum, "melhor canal" vazio pareceria bug — a
                      mensagem diz o que falta fazer. */}
                  {p.bestChannel ? (
                    <div className="rounded-xl surface-2 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted">
                        Melhor canal{p.pricedChannels > 1 ? ` de ${p.pricedChannels}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">{p.bestChannel.channelName}</p>
                      <p className="text-sm">
                        <span className="text-muted">{formatCurrency(p.bestChannel.price)} → </span>
                        <span className={cn("font-bold", toneForProfit(p.bestChannel.economics.profit))}>
                          {formatCurrency(p.bestChannel.economics.profit)}
                        </span>
                        <span className="text-muted"> ({formatPercent(p.bestChannel.economics.marginPercent, 1)})</span>
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-xl surface-2 px-3 py-2 text-xs text-muted">
                      Nenhum preço definido ainda — abra pra ver o sugerido em cada canal.
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProdutoModal open={criando} onClose={() => setCriando(false)} />
    </div>
  );
}
