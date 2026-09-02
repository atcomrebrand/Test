import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { BestPurchaseDay, DayBucket, DayPriceIndex } from "../types";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function nomeLongo(day: number, bucket: DayBucket): string {
  return bucket === "WEEKDAY" ? DIAS[day] : `Dia ${day}`;
}

function nomeCurto(day: number, bucket: DayBucket): string {
  return bucket === "WEEKDAY" ? CURTO[day] : String(day);
}

/**
 * O que falta pra responder, dito em português — e não "dados insuficientes", que não diz o que
 * fazer. Cada motivo tem uma ação diferente do outro lado, e o recorte de dia do mês precisa da
 * própria frase: são 31 grupos pra mesma quantidade de notas, então ele demora bem mais a encher e
 * a explicação genérica soaria como se algo estivesse errado.
 */
function motivo(reason: BestPurchaseDay["reason"], bucket: DayBucket): string {
  if (reason === "SEM_COMPRAS") return "Importe algumas notas e este card começa a se formar sozinho.";
  if (reason === "SEM_PRODUTO_REPETIDO") {
    return bucket === "WEEKDAY"
      ? "Ainda não há produto comprado em dias diferentes da semana. Assim que você repetir um item num outro dia, dá pra comparar."
      : "Ainda não há produto comprado em dias do mês diferentes. Assim que você repetir um item numa outra data, dá pra comparar.";
  }
  return bucket === "WEEKDAY"
    ? "Ainda são poucas repetições pra afirmar um padrão — o card se completa conforme as compras se repetem."
    : "Ainda são poucas repetições. O dia do mês reparte as mesmas notas em 31 grupos em vez de 7, então ele demora mais a encher que o dia da semana.";
}

/**
 * Em que dia a compra sai mais barata — por dia da semana ou por dia do mês.
 *
 * O card mostra o índice, e não o gasto médio por ida: o gasto de uma ida depende do carrinho, e o
 * rancho do mês faria o sábado parecer o dia mais caro do ano por ter comprado mais coisa. Aqui
 * cada produto é comparado consigo mesmo (ver `bestPurchaseDay`, no domain).
 *
 * **Os dois recortes vêm juntos na resposta**, e trocar entre eles não vai ao servidor: são a mesma
 * conta sobre as mesmas observações, e uma requisição por clique seria ida à rede pra devolver algo
 * que já estava na tela.
 *
 * Fica **fora do recorte de mês**, pela mesma razão do "o que mais subiu de preço": a comparação se
 * mede entre compras repetidas, e dentro de um mês raramente há duas do mesmo item — filtrar
 * esvaziaria o card justamente no uso mais comum.
 */
export function BestPurchaseDayCard({ data }: { data: { weekday: BestPurchaseDay; dayOfMonth: BestPurchaseDay } }) {
  const [bucket, setBucket] = useState<DayBucket>("WEEKDAY");
  const atual = bucket === "WEEKDAY" ? data.weekday : data.dayOfMonth;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Melhor dia de compra</CardTitle>
        <span className="text-xs text-muted">Histórico inteiro</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex rounded-lg surface-2 p-0.5">
          {(
            [
              ["WEEKDAY", "Dia da semana"],
              ["DAY_OF_MONTH", "Dia do mês"],
            ] as [DayBucket, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBucket(value)}
              aria-pressed={bucket === value}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                bucket === value ? "surface shadow-sm" : "text-muted hover:text-[rgb(var(--text))]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {atual.best ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{nomeLongo(atual.best.day, bucket)}</p>
                {/* "Que o preço de sempre", e não "que os outros dias": o índice compara cada
                    produto com a PRÓPRIA média em todos os dias, que é o que o torna imune ao
                    tamanho do carrinho. Dizer "que os outros dias" descreveria outra conta. */}
                <p className="text-sm text-muted">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {(100 - atual.best.index).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais barato
                  </span>{" "}
                  que o preço de sempre
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {atual.days.map((d) => (
                <Barra key={d.day} dia={d} dias={atual.days} bucket={bucket} destaque={d.day === atual.best!.day} />
              ))}
            </div>

            {/* De onde o número saiu. Sem isso o card afirma sem dizer com que base — e a base é
                pequena no começo, o que muda o quanto se deve confiar nele. */}
            <p className="text-xs text-muted">
              Comparando o preço de {atual.comparableProducts} {atual.comparableProducts === 1 ? "produto" : "produtos"} que você comprou em
              dias diferentes, em {atual.observations} idas ao mercado. Só entram produtos repetidos — o tamanho do carrinho não conta.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{motivo(atual.reason, bucket)}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Barra({ dia, dias, bucket, destaque }: { dia: DayPriceIndex; dias: DayPriceIndex[]; bucket: DayBucket; destaque: boolean }) {
  // A barra mede o desvio em relação a 100, não o índice cru: uma barra proporcional a 96 e outra a
  // 104 seriam quase do mesmo tamanho e a diferença — que é o assunto — sumiria. O maior desvio da
  // lista define a escala.
  const maior = Math.max(...dias.map((x) => Math.abs(x.index - 100)), 1);
  const desvio = dia.index - 100;
  const largura = (Math.abs(desvio) / maior) * 50;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("w-9 shrink-0", destaque ? "font-bold" : "text-muted")}>{nomeCurto(dia.day, bucket)}</span>
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
}
