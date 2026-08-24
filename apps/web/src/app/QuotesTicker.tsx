import { useLayoutEffect, useRef, useState } from "react";
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
 * Velocidade da faixa, em pixels por segundo. **É a única constante pra mexer se ficar rápida ou
 * lenta demais** — menor é mais devagar.
 *
 * A duração da animação sai daqui e da largura medida do conteúdo, não da contagem de itens. Contar
 * item não funciona porque item não tem largura fixa: "🪙 BTC R$ 300.000,00" ocupa quase o triplo
 * de "🇺🇸 USD R$ 5,09", então uma carteira com cripto passaria voando e uma sem passaria arrastada,
 * com a mesma configuração. Medindo, a leitura fica no mesmo ritmo em qualquer carteira.
 */
const PIXELS_POR_SEGUNDO = 20;

/** Piso de duração pra faixa curta (um item só) não dar a volta a cada poucos segundos. */
const DURACAO_MINIMA_S = 20;

/** Ticker rolante estilo jornal: dólar mais os ativos em carteira, na ordem que o backend mandar.
 *  Duplica os itens uma vez e anima translateX até -50% em loop infinito, então a "emenda" fica
 *  invisível (o segundo bloco é idêntico ao primeiro). */
export function QuotesTicker() {
  const { data } = useQuotesTicker();
  const faixa = useRef<HTMLDivElement>(null);
  const [duracao, setDuracao] = useState(DURACAO_MINIMA_S);

  // Mede depois de pintar: a largura só existe com os itens já renderizados, e ela muda quando a
  // carteira muda (ativo novo, cotação que passa de 3 pra 6 dígitos).
  useLayoutEffect(() => {
    const el = faixa.current;
    if (!el) return;
    // Metade porque o conteúdo está duplicado — a animação percorre exatamente uma cópia.
    const distancia = el.scrollWidth / 2;
    if (distancia <= 0) return;

    const proxima = Math.max(DURACAO_MINIMA_S, distancia / PIXELS_POR_SEGUNDO);
    // Mudar a duração reinicia a animação, e a faixa dá um salto de volta pro começo. Como o
    // ticker revalida sozinho a cada 5min, um preço que ganha um dígito (R$ 9,99 → R$ 10,01)
    // bastaria pra isso acontecer na cara de quem está lendo. Só vale o ajuste quando ele é grande
    // o bastante pra ser percebido como velocidade.
    setDuracao((atual) => (Math.abs(proxima - atual) > 1 ? proxima : atual));
  }, [data]);

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
        ref={faixa}
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duracao}s` }}
      >
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
