import { TrendingUp, TrendingDown } from "lucide-react";
import { QuoteTickerItem, useQuotesTicker } from "@/features/useQuotes";

/**
 * Moeda leva uma casa a mais que o resto do app: com 2 dígitos o movimento minuto a minuto de um
 * par some (5,09 / 5,10 / 5,11 viram todos a mesma vizinhança), que é o que fazia o ticker parecer
 * travado.
 *
 * Ativo, não: preço de ação se escreve com 2 casas, e um bitcoin a "R$ 320.000,000" é ruído de
 * três dígitos que ninguém lê.
 */
function formatRate(value: number, kind: QuoteTickerItem["kind"]) {
  const casas = kind === "CURRENCY" ? 3 : 2;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(value);
}

/**
 * Segundos por item na passagem.
 *
 * A animação tem duração fixa no Tailwind (20s pra percorrer metade da faixa), o que na prática
 * amarra a *velocidade* à quantidade de itens: com o dólar sozinho passa devagar, com a carteira
 * inteira dispararia. Aqui a duração cresce junto com o número de itens, então o que fica constante
 * é a velocidade de leitura — que é o que importa em ticker.
 */
const SEGUNDOS_POR_ITEM = 3.5;

/** Piso pra não acelerar demais quando há pouca coisa (é a duração que a faixa já tinha com o dólar
 *  sozinho). */
const DURACAO_MINIMA_S = 20;

/** Ticker rolante estilo jornal: dólar mais os ativos em carteira, na ordem que o backend mandar.
 *  Duplica os itens uma vez e anima translateX até -50% em loop infinito, então a "emenda" fica
 *  invisível (o segundo bloco é idêntico ao primeiro). */
export function QuotesTicker() {
  const { data } = useQuotesTicker();

  if (!data || data.length === 0) return null;

  const renderItems = (keyPrefix: string) =>
    data.map((item, i) => {
      const isUp = item.rate !== null && item.previousClose !== null && item.rate > item.previousClose;
      const isDown = item.rate !== null && item.previousClose !== null && item.rate < item.previousClose;

      return (
        <span key={`${keyPrefix}-${item.symbol}-${i}`} className="flex items-center gap-2 whitespace-nowrap px-6 text-sm">
          <span aria-hidden>{item.flag}</span>
          <span className="font-medium text-muted">{item.label}</span>
          <span className="font-semibold">{item.rate !== null ? formatRate(item.rate, item.kind) : "cotação indisponível"}</span>
          {isUp && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-label="Em alta desde o fechamento anterior" />}
          {isDown && <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-label="Em queda desde o fechamento anterior" />}
        </span>
      );
    });

  return (
    <div className="group overflow-hidden border-b border-[rgb(var(--border))] surface-2 py-2">
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${Math.max(DURACAO_MINIMA_S, data.length * SEGUNDOS_POR_ITEM)}s` }}
      >
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
