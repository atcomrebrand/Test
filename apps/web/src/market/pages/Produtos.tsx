import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Merge, Package, Search, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useMarketProducts, useMergeProducts } from "../api";
import { MergeSelectionBar, MergeSuggestions } from "../components/MergeSuggestions";

type SortKey = "gasto" | "alta" | "baixa" | "nome";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "gasto", label: "Mais gasto" },
  { key: "alta", label: "Maior alta" },
  { key: "baixa", label: "Maior baixa" },
  { key: "nome", label: "Nome" },
];

export default function Produtos() {
  const { data: products, isLoading } = useMarketProducts();
  const merge = useMergeProducts();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("gasto");
  /** null = navegando normalmente; Set = modo de seleção pra unir à mão. Dois modos no mesmo lugar
   *  porque a lista é a mesma — o que muda é o que o toque na linha faz. */
  const [selecao, setSelecao] = useState<Set<string> | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = (products ?? []).filter((p) => !term || p.name.toLowerCase().includes(term));

    return [...filtered].sort((a, b) => {
      if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR");

      // Produto comprado uma vez só não tem variação: uma observação de preço não é tendência.
      // Ele vai pro fim nos DOIS sentidos — tratar como 0% o colocaria no meio da lista dizendo
      // "não mudou de preço", que é uma afirmação que o dado não sustenta.
      if (sort === "alta" || sort === "baixa") {
        const ca = a.summary?.changePercent;
        const cb = b.summary?.changePercent;
        if (ca === null || ca === undefined) return 1;
        if (cb === null || cb === undefined) return -1;
        return sort === "alta" ? cb - ca : ca - cb;
      }

      return (b.summary?.totalSpent ?? 0) - (a.summary?.totalSpent ?? 0);
    });
  }, [products, query, sort]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <>
        <PageHeader title="Produtos" description="Tudo que você já comprou, com o preço que pagou em cada nota." />
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto ainda"
          description="Os produtos entram sozinhos quando você importa uma nota — não precisa cadastrar nada à mão."
          action={
            <Link to="/mercado/importar" className="text-sm font-medium text-sky-500 hover:underline">
              Importar uma nota
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Produtos" description="Tudo que você já comprou, com o preço que pagou em cada nota." />

      <MergeSuggestions />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" className="pl-9" />
        </div>
        <Button
          size="sm"
          variant={selecao ? "primary" : "outline"}
          onClick={() => setSelecao((atual) => (atual ? null : new Set()))}
          className="gap-1.5"
          title="Marcar produtos que são o mesmo item e unir o histórico"
        >
          <Merge className="h-4 w-4" />
          Unir
        </Button>

        <div className="flex flex-wrap gap-1 rounded-xl border border-[rgb(var(--border))] p-1">
          {SORTS.map((option) => (
            <button
              key={option.key}
              onClick={() => setSort(option.key)}
              className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                sort === option.key ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "text-muted hover:surface-2"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <MergeSelectionBar
        selecionados={(products ?? []).filter((p) => selecao?.has(p.id)).map((p) => ({ id: p.id, name: p.name }))}
        onCancelar={() => setSelecao(null)}
        unindo={merge.isPending}
        onUnir={(canonicalId) =>
          merge.mutate(
            { canonicalId, ids: [...(selecao ?? [])] },
            { onSuccess: () => setSelecao(null) },
          )
        }
      />

      {visible.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhum produto com “{query}”.</p>}

      <div className="flex flex-col gap-3">
        {visible.map((product) => {
          const summary = product.summary;
          const change = summary?.changePercent ?? null;
          const marcado = selecao?.has(product.id) ?? false;

          const conteudo = (
            <CardContent className="flex items-center gap-3">
              {selecao && (
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs",
                    marcado ? "border-sky-500 bg-sky-500 text-white" : "border-[rgb(var(--border))]",
                  )}
                >
                  {marcado && "✓"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-medium">{product.name}</p>
                  {/* Produto unido diz que é: sem isso, o histórico teria compras de um nome que
                      não aparece em lugar nenhum da tela. */}
                  {product.mergedCount > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                      <Merge className="h-3 w-3" />+{product.mergedCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {summary
                    ? `${formatCurrency(summary.lastPrice)}/${product.unit} · ${summary.timesBought} ${summary.timesBought === 1 ? "compra" : "compras"}`
                    : "Sem compras"}
                </p>
                {summary && <p className="mt-0.5 text-xs text-muted">{formatCurrency(summary.totalSpent)} no total</p>}
              </div>

              {change !== null && (
                <span
                  className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${change > 0 ? "text-red-500" : change < 0 ? "text-emerald-500" : "text-muted"}`}
                >
                  {change > 0 ? <TrendingUp className="h-4 w-4" /> : change < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                  {change > 0 ? "+" : ""}
                  {formatPercent(change)}
                </span>
              )}
              {change === null && <span className="shrink-0 text-xs text-muted">1ª compra</span>}
            </CardContent>
          );

          // Em modo de seleção a linha marca em vez de navegar: sair da tela no meio da escolha
          // perderia a seleção inteira.
          return (
            <Card key={product.id} className={cn(marcado && "border-sky-500")}>
              {selecao ? (
                <button
                  type="button"
                  className="w-full text-left"
                  aria-pressed={marcado}
                  onClick={() =>
                    setSelecao((atual) => {
                      const proxima = new Set(atual);
                      if (proxima.has(product.id)) proxima.delete(product.id);
                      else proxima.add(product.id);
                      return proxima;
                    })
                  }
                >
                  {conteudo}
                </button>
              ) : (
                <Link to={`/mercado/produtos/${product.id}`}>{conteudo}</Link>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
