import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { BestPurchaseWeekday } from "../types";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** O que falta pra responder, dito em português — e não "dados insuficientes", que não diz o que
 *  fazer. Cada motivo tem uma ação diferente do outro lado. */
const MOTIVO: Record<NonNullable<BestPurchaseWeekday["reason"]>, string> = {
  SEM_COMPRAS: "Importe algumas notas e este card começa a se formar sozinho.",
  SEM_PRODUTO_REPETIDO:
    "Ainda não há produto comprado em dias diferentes da semana. Assim que você repetir um item num outro dia, dá pra comparar.",
  POUCA_AMOSTRA: "Ainda são poucas repetições pra afirmar um padrão — o card se completa conforme as compras se repetem.",
};

/**
 * Em que dia da semana a compra sai mais barata.
 *
 * O card mostra o índice, e não o gasto médio por ida: o gasto de uma ida depende do carrinho, e o
 * rancho do mês faria o sábado parecer o dia mais caro do ano por ter comprado mais coisa. Aqui
 * cada produto é comparado consigo mesmo (ver `bestPurchaseWeekday`, no domain).
 *
 * Fica **fora do recorte de mês**, pela mesma razão do "o que mais subiu de preço": a comparação se
 * mede entre compras repetidas, e dentro de um mês raramente há duas do mesmo item — filtrar
 * esvaziaria o card justamente no uso mais comum.
 */
export function BestWeekdayCard({ data }: { data: BestPurchaseWeekday }) {
  const { best, weekdays } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Melhor dia de compra</CardTitle>
        <span className="text-xs text-muted">Histórico inteiro</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {best ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{DIAS[best.weekday]}</p>
                {/* "Que o preço de sempre", e não "que os outros dias": o índice compara cada
                    produto com a PRÓPRIA média em todos os dias, que é o que o torna imune ao
                    tamanho do carrinho. Dizer "que os outros dias" descreveria outra conta. */}
                <p className="text-sm text-muted">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {(100 - best.index).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais barato
                  </span>{" "}
                  que o preço de sempre
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {weekdays.map((w) => {
                // A barra mede o desvio em relação a 100, não o índice cru: uma barra proporcional a
                // 96 e outra a 104 seriam quase do mesmo tamanho e a diferença — que é o assunto —
                // sumiria. O maior desvio da lista define a escala.
                const maior = Math.max(...weekdays.map((x) => Math.abs(x.index - 100)), 1);
                const desvio = w.index - 100;
                const largura = (Math.abs(desvio) / maior) * 50;
                return (
                  <div key={w.weekday} className="flex items-center gap-2 text-xs">
                    <span className={cn("w-9 shrink-0", w.weekday === best.weekday ? "font-bold" : "text-muted")}>{CURTO[w.weekday]}</span>
                    {/* Eixo no meio: barra pra esquerda é mais barato, pra direita é mais caro. */}
                    <span className="relative h-2 flex-1 rounded-full surface-2">
                      <span
                        className={cn("absolute top-0 h-2", desvio <= 0 ? "rounded-l-full bg-emerald-500" : "rounded-r-full bg-red-400")}
                        style={desvio <= 0 ? { right: "50%", width: `${largura}%` } : { left: "50%", width: `${largura}%` }}
                      />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-[rgb(var(--border))]" />
                    </span>
                    <span className={cn("w-14 shrink-0 text-right tabular-nums", desvio <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                      {desvio > 0 ? "+" : ""}
                      {desvio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* De onde o número saiu. Sem isso o card afirma sem dizer com que base — e a base é
                pequena no começo, o que muda o quanto se deve confiar nele. */}
            <p className="text-xs text-muted">
              Comparando o preço de {data.comparableProducts} {data.comparableProducts === 1 ? "produto" : "produtos"} que você comprou em
              dias diferentes, em {data.observations} idas ao mercado. Só entram produtos repetidos — o tamanho do carrinho não conta.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{MOTIVO[data.reason ?? "SEM_COMPRAS"]}</p>
        )}
      </CardContent>
    </Card>
  );
}
