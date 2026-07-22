import { useQuotesTicker } from "@/features/useQuotes";
import { formatCurrency } from "@/lib/format";

/** Ticker rolante estilo jornal — hoje só dólar, mas o array já vem pronto do backend pra receber
 *  mais moedas/ativos depois sem mudar nada aqui. Duplica os itens uma vez e anima translateX até
 *  -50% em loop infinito, então a "emenda" fica invisível (o segundo bloco é idêntico ao primeiro). */
export function QuotesTicker() {
  const { data } = useQuotesTicker();

  if (!data || data.length === 0) return null;

  const renderItems = (keyPrefix: string) =>
    data.map((item, i) => (
      <span key={`${keyPrefix}-${item.symbol}-${i}`} className="flex items-center gap-2 whitespace-nowrap px-6 text-sm">
        <span aria-hidden>{item.flag}</span>
        <span className="font-medium text-muted">{item.label}</span>
        <span className="font-semibold">{item.rate !== null ? formatCurrency(item.rate) : "cotação indisponível"}</span>
      </span>
    ));

  return (
    <div className="group overflow-hidden border-b border-[rgb(var(--border))] surface-2 py-2">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
