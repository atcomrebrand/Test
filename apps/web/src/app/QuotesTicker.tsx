import { TrendingUp, TrendingDown } from "lucide-react";
import { useQuotesTicker } from "@/features/useQuotes";

/** Same currency formatting the rest of the app uses, but with one extra decimal — 2 digits hides
 *  the minute-to-minute movement a currency pair actually has (5,09 vs 5,10 vs 5,11 all round to
 *  "R$ 5,09"-ish territory at 2 digits, which is exactly what made the ticker feel unresponsive). */
function formatRate(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
    value,
  );
}

/** Ticker rolante estilo jornal — hoje só dólar, mas o array já vem pronto do backend pra receber
 *  mais moedas/ativos depois sem mudar nada aqui. Duplica os itens uma vez e anima translateX até
 *  -50% em loop infinito, então a "emenda" fica invisível (o segundo bloco é idêntico ao primeiro). */
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
          <span className="font-semibold">{item.rate !== null ? formatRate(item.rate) : "cotação indisponível"}</span>
          {isUp && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-label="Em alta desde o fechamento anterior" />}
          {isDown && <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-label="Em queda desde o fechamento anterior" />}
        </span>
      );
    });

  return (
    <div className="group overflow-hidden border-b border-[rgb(var(--border))] surface-2 py-2">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
