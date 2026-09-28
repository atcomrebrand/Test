import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useArchiveProduct, useProfitProduct, useSetProductPrice } from "../api";
import { ProdutoModal } from "../components/ProdutoModal";
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
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const arquivar = useArchiveProduct();
  const [meta, setMeta] = useState("0");
  const metaValor = meta.trim() === "" ? 0 : Number(meta.replace(",", ".")) || 0;
  const { data, isLoading } = useProfitProduct(id, metaValor);
  const [aberto, setAberto] = useState<string | null>(null);
  const definirPreco = useSetProductPrice();

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

      <div className={cn("flex items-start justify-between gap-3 rounded-3xl border p-5", PROFIT.border, PROFIT.soft)}>
        <div className="min-w-0">
          <h1 className="text-2xl font-black leading-tight">{data.product.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {data.product.sku ? `${data.product.sku} · ` : ""}
            custo total por unidade{" "}
            <span className="font-semibold text-[rgb(var(--text))]">
              {formatCurrency(data.product.cost + data.product.packagingCost + data.product.extraCost)}
            </span>
          </p>
        </div>
        {/* Mudou o custo de compra? Todo preço sugerido e toda margem desta tela recalculam — é o
            motivo de o módulo guardar o produto em vez de ser só calculadora. */}
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setEditando(true)} aria-label="Editar produto" className="rounded-lg p-2 text-muted hover:surface-2">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setArquivando(true)} aria-label="Arquivar produto" className="rounded-lg p-2 text-muted hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
            <SuggestedPrice
              a={selecionado}
              targetMargin={selecionado.targetMarginPercent}
              onPickRounded={(price) => definirPreco.mutate({ productId: data.product.id, channelId: selecionado.channelId, price })}
            />
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

      <ProdutoModal open={editando} onClose={() => setEditando(false)} produto={data.product} />

      <ConfirmModal
        open={arquivando}
        onClose={() => setArquivando(false)}
        onConfirm={() => arquivar.mutate(data.product.id, { onSuccess: () => navigate("/lucro/produtos") })}
        title="Arquivar produto"
        description={`"${data.product.name}" sai da lista. Os preços que você definiu nos canais continuam guardados.`}
        confirmLabel="Arquivar"
      />
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
  const [margem, setMargem] = useState(String(c.targetMarginPercent));

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")) || 0);

  function confirmar() {
    salvar.mutate(
      {
        productId: produtoId,
        channelId: c.channelId,
        // Preço vazio LIMPA o preço e faz o canal voltar a mostrar o sugerido — é a forma de dizer
        // "ainda não vendo aqui" sem apagar o canal.
        price: num(preco),
        targetMarginPercent: num(margem),
      },
      { onSuccess: () => setEditando(false) },
    );
  }

  if (editando) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-xl surface-2 px-3 py-2">
        <span className="basis-full text-sm font-semibold sm:basis-auto sm:self-center">{c.channelName}</span>
        <Input
          label="Preço (R$)"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          className="h-9"
          hint="Vazio = usa o sugerido"
          autoFocus
        />
        <Input
          label="Margem alvo (%)"
          inputMode="decimal"
          value={margem}
          onChange={(e) => setMargem(e.target.value)}
          className="h-9 w-28"
        />
        <Button className="mb-0.5 h-9 shrink-0" loading={salvar.isPending} onClick={confirmar}>
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
        onClick={(e) => { e.stopPropagation(); setPreco(c.priceIsSuggested ? "" : String(c.economics.price)); setMargem(String(c.targetMarginPercent)); setEditando(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditando(true); } }}
        className="shrink-0 rounded-lg p-1.5 text-muted hover:surface"
      >
        <Pencil className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
