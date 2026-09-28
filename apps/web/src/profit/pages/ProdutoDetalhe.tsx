import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { useProfitProduct, useSetProductPrice } from "../api";
import { BreakEvenCard, CostBreakdown, DiscountTable, SuggestedPrice, ThreeNumbers } from "../components/Economics";
import { CHANNEL_LABEL, PROFIT, formatPercent, toneForProfit } from "../theme";
import { ChannelComparison } from "../types";

/**
 * Um produto com todos os canais lado a lado.
 *
 * **Canal sem preço definido aparece com o sugerido**, marcado como sugestão. A pergunta "onde
 * compensa vender isso" precisa incluir o lugar onde você ainda não vende — deixá-lo de fora
 * esconderia justamente a resposta que se procura.
 */
export default function ProdutoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState("0");
  const metaValor = meta.trim() === "" ? 0 : Number(meta.replace(",", ".")) || 0;
  const { data, isLoading } = useProfitProduct(id, metaValor);
  const [aberto, setAberto] = useState<string | null>(null);

  if (isLoading || !data) return <Skeleton className="h-96 rounded-3xl" />;

  const ordenados = [...data.comparison].sort((a, b) => b.economics.profit - a.economics.profit);
  const melhor = ordenados.find((c) => !c.priceIsSuggested) ?? ordenados[0];
  const selecionado = ordenados.find((c) => c.channelId === aberto) ?? melhor;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/lucro/produtos" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Produtos
      </Link>

      <div className={cn("rounded-3xl border p-5", PROFIT.border, PROFIT.soft)}>
        <h1 className="text-2xl font-black leading-tight">{data.product.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {data.product.sku ? `${data.product.sku} · ` : ""}
          custo total por unidade{" "}
          <span className="font-semibold text-[rgb(var(--text))]">
            {formatCurrency(data.product.cost + data.product.packagingCost + data.product.extraCost)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Meta de lucro no mês (R$)"
          inputMode="decimal"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          className="w-44"
        />
        <p className="pb-2 text-xs text-muted">Recalcula quantas vendas cada canal precisa.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Onde compensa vender</p>
          {ordenados.map((c) => (
            <LinhaCanal
              key={c.channelId}
              c={c}
              produtoId={data.product.id}
              melhor={c.channelId === ordenados[0].channelId}
              ativo={c.channelId === selecionado?.channelId}
              onAbrir={() => setAberto(c.channelId)}
            />
          ))}
        </CardContent>
      </Card>

      {selecionado && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SuggestedPrice a={selecionado} targetMargin={selecionado.targetMarginPercent} />
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                  {selecionado.channelName} · {formatCurrency(selecionado.economics.price)}
                  {selecionado.priceIsSuggested && <span className="ml-1 normal-case tracking-normal">(sugerido)</span>}
                </p>
                <ThreeNumbers e={selecionado.economics} />
                <CostBreakdown e={selecionado.economics} />
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <BreakEvenCard a={selecionado} />
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Se você der desconto</p>
                <DiscountTable discounts={selecionado.discounts} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaCanal({
  c,
  produtoId,
  melhor,
  ativo,
  onAbrir,
}: {
  c: ChannelComparison;
  produtoId: string;
  melhor: boolean;
  ativo: boolean;
  onAbrir: () => void;
}) {
  const salvar = useSetProductPrice();
  const [editando, setEditando] = useState(false);
  const [preco, setPreco] = useState(String(c.economics.price));

  function confirmar() {
    salvar.mutate(
      { productId: produtoId, channelId: c.channelId, price: preco.trim() === "" ? null : Number(preco.replace(",", ".")) },
      { onSuccess: () => setEditando(false) },
    );
  }

  if (editando) {
    return (
      <div className="flex items-center gap-2 rounded-xl surface-2 px-3 py-2">
        <span className="w-32 shrink-0 truncate text-sm font-semibold">{c.channelName}</span>
        <Input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} className="h-9" autoFocus />
        <Button className="h-9 shrink-0" loading={salvar.isPending} onClick={confirmar}>
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        ativo ? "surface-2" : "hover:surface-2",
      )}
    >
      <span className="flex w-32 shrink-0 items-center gap-1.5">
        {melhor && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="min-w-0 truncate font-semibold">{c.channelName}</span>
      </span>
      {/* "sug." e não um "?" solto: o canal onde você ainda não vende entra na comparação com o
          preço SUGERIDO, e confundi-lo com o preço praticado inverteria a conclusão da tela. */}
      <span className="w-24 shrink-0 tabular-nums text-muted">
        {formatCurrency(c.economics.price)}
        {c.priceIsSuggested && <span className="ml-1 rounded surface px-1 text-[10px] font-semibold not-italic">sug.</span>}
      </span>
      <span className={cn("w-20 shrink-0 tabular-nums font-bold", toneForProfit(c.economics.profit))}>
        {formatCurrency(c.economics.profit)}
      </span>
      <span className="hidden w-16 shrink-0 text-xs text-muted sm:inline">{formatPercent(c.economics.marginPercent, 1)}</span>
      <span className="min-w-0 flex-1 truncate text-right text-xs text-muted">
        {CHANNEL_LABEL[c.channelType]}
        {c.breakEven.units !== null && <> · {c.breakEven.units} p/ empatar</>}
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Definir preço em ${c.channelName}`}
        onClick={(e) => { e.stopPropagation(); setPreco(String(c.economics.price)); setEditando(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditando(true); } }}
        className="shrink-0 rounded-lg p-1.5 text-muted hover:surface"
      >
        <Pencil className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
