import { useState } from "react";
import { Check, Merge, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { MergeSuggestion } from "../types";
import { useMergeProducts, useMergeSuggestions } from "../api";

const CHAVE_IGNORADAS = "market-merge-ignoradas";

/**
 * Sugestões ignoradas ficam no localStorage, não no banco.
 *
 * É preferência de tela: dizer "não, esses dois são diferentes" não é um dado que valha uma tabela,
 * uma migration e um endpoint. O custo de perder isso é a sugestão reaparecer num navegador novo —
 * incômodo pequeno e reversível, ao contrário de unir errado.
 */
function lerIgnoradas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_IGNORADAS) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function gravarIgnoradas(ignoradas: Set<string>) {
  try {
    localStorage.setItem(CHAVE_IGNORADAS, JSON.stringify([...ignoradas]));
  } catch {
    // Sem persistência a decisão vale nesta sessão — só não sobrevive ao refresh.
  }
}

/** O par, independente da ordem em que o servidor devolveu. */
function chaveDoPar(sugestao: MergeSuggestion): string {
  return [...sugestao.ids].sort().join("|");
}

/**
 * "Esses dois parecem o mesmo produto" — a resposta pro fato de cada mercado nomear o produto do
 * seu jeito, que nenhuma normalização de texto resolve.
 *
 * A máquina propõe e a pessoa decide, sempre: unir dois produtos diferentes estraga o histórico de
 * preço de um jeito que ninguém percebe depois, enquanto deixar dois separados é um incômodo
 * visível e corrigível. Por isso não existe "unir tudo".
 */
export function MergeSuggestions() {
  const { data: sugestoes } = useMergeSuggestions();
  const merge = useMergeProducts();
  const [ignoradas, setIgnoradas] = useState(lerIgnoradas);
  const [aberto, setAberto] = useState(false);

  const visiveis = (sugestoes ?? []).filter((s) => !ignoradas.has(chaveDoPar(s)));
  if (visiveis.length === 0) return null;

  const ignorar = (sugestao: MergeSuggestion) => {
    const proximas = new Set(ignoradas);
    proximas.add(chaveDoPar(sugestao));
    setIgnoradas(proximas);
    gravarIgnoradas(proximas);
  };

  return (
    <Card className="mb-4 border-sky-500/30 bg-sky-500/5">
      <CardContent className="flex flex-col gap-3 py-3">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 text-left">
          <Merge className="h-4 w-4 shrink-0 text-sky-500" />
          <span className="flex-1 text-sm font-medium">
            {visiveis.length} {visiveis.length === 1 ? "par parece" : "pares parecem"} o mesmo produto com nomes
            diferentes
          </span>
          <span className="text-xs text-muted">{aberto ? "fechar" : "ver"}</span>
        </button>

        {aberto && (
          <div className="flex flex-col gap-2">
            {visiveis.map((sugestao) => (
              <div key={chaveDoPar(sugestao)} className="surface rounded-xl border border-[rgb(var(--border))] p-3">
                <div className="flex flex-col gap-1 text-sm">
                  {sugestao.names.map((nome, i) => (
                    <p key={i} className="truncate">
                      {nome}
                    </p>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted">Em comum: {sugestao.shared.join(", ")}</p>

                {/* Qual nome fica é escolha de quem une, não do maior score: é ele que vai aparecer
                    na lista pra sempre. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {sugestao.names.map((nome, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={i === 0 ? "primary" : "secondary"}
                      loading={merge.isPending}
                      onClick={() => merge.mutate({ canonicalId: sugestao.ids[i], ids: [...sugestao.ids] })}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Unir com o nome “{nome.length > 22 ? `${nome.slice(0, 22)}…` : nome}”
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => ignorar(sugestao)} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    São diferentes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Barra da seleção manual: aparece quando há produto marcado e some quando não há. */
export function MergeSelectionBar({
  selecionados,
  onCancelar,
  onUnir,
  unindo,
}: {
  selecionados: { id: string; name: string }[];
  onCancelar: () => void;
  onUnir: (canonicalId: string) => void;
  unindo: boolean;
}) {
  if (selecionados.length === 0) return null;

  return (
    <div className="sticky bottom-20 z-10 mb-3 sm:bottom-4">
      <Card className="border-sky-500/40 shadow-lg">
        <CardContent className="flex flex-col gap-2 py-3">
          <p className="text-sm font-medium">
            {selecionados.length} selecionado{selecionados.length > 1 ? "s" : ""}
            {selecionados.length < 2 && <span className="text-muted"> — marque pelo menos dois pra unir</span>}
          </p>

          {selecionados.length >= 2 && (
            <>
              <p className="text-xs text-muted">Qual nome fica?</p>
              <div className="flex flex-wrap gap-2">
                {selecionados.map((produto) => (
                  <Button
                    key={produto.id}
                    size="sm"
                    variant="secondary"
                    loading={unindo}
                    onClick={() => onUnir(produto.id)}
                    className={cn("max-w-full")}
                  >
                    <span className="truncate">{produto.name}</span>
                  </Button>
                ))}
              </div>
            </>
          )}

          <Button size="sm" variant="ghost" onClick={onCancelar} className="self-start">
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
