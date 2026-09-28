import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { Analysis, DiscountImpact, UnitEconomics } from "../types";
import { PROFIT, formatPercent, toneForProfit } from "../theme";

/**
 * Os três números lado a lado, sempre nomeados.
 *
 * Margem, markup e ROI descrevem a mesma venda e dão resultados bem diferentes — comprou por 50 e
 * vendeu por 100 é markup de 100%, margem de 50% e ROI de 100%. Mostrá-los juntos e rotulados é o
 * que impede o erro clássico de calcular um e ler como o outro.
 */
export function ThreeNumbers({ e }: { e: UnitEconomics }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Numero label="Margem" hint="sobre o preço" valor={formatPercent(e.marginPercent)} tone={toneForProfit(e.profit)} />
      <Numero label="Markup" hint="sobre o custo" valor={formatPercent(e.markupPercent)} />
      <Numero label="ROI" hint="sobre o investido" valor={formatPercent(e.roiPercent)} />
    </div>
  );
}

function Numero({ label, hint, valor, tone }: { label: string; hint: string; valor: string; tone?: string }) {
  return (
    <div className="rounded-xl surface-2 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold", tone)}>{valor}</p>
      <p className="text-[10px] text-muted">{hint}</p>
    </div>
  );
}

/** A conta aberta: de onde saiu cada real. Sem isso o lucro é um número que a pessoa aceita ou
 *  não — com isso ela vê qual custo está comendo a margem. */
export function CostBreakdown({ e }: { e: UnitEconomics }) {
  // Só o que existe entra na conta aberta: linha zerada ("Imposto R$ 0,00") é ruído que faz
  // procurar significado onde não tem.
  const linhas = (
    [
      ["Produto", e.productCost],
      ["Embalagem", e.packagingCost],
      ["Frete que você paga", e.shippingCost],
      ["Outros custos", e.extraCost],
      ["Taxa do canal", e.channelFeeAmount],
      ["Imposto", e.taxAmount],
      ["Devolução esperada", e.returnLoss],
    ] as [string, number][]
  ).filter(([, v]) => v > 0);

  return (
    <div className="flex flex-col divide-y divide-[rgb(var(--border))] text-sm">
      <Linha label="Preço de venda" valor={e.price} forte />
      {linhas.map(([label, v]) => (
        <Linha key={label} label={label} valor={-v} />
      ))}
      <Linha label="Lucro por venda" valor={e.profit} forte tone={toneForProfit(e.profit)} />
    </div>
  );
}

function Linha({ label, valor, forte, tone }: { label: string; valor: number; forte?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className={cn(forte ? "font-semibold" : "text-muted")}>{label}</span>
      <span className={cn("tabular-nums", forte ? "font-bold" : "text-muted", tone)}>
        {valor < 0 ? "−" : ""}
        {formatCurrency(Math.abs(valor))}
      </span>
    </div>
  );
}

/** O preço sugerido — ou o aviso de que ele não existe. */
export function SuggestedPrice({ a, targetMargin }: { a: Analysis; targetMargin: number }) {
  if (!a.suggested.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          Taxas, imposto e margem somam <span className="font-bold">{formatPercent(a.suggested.totalPercent, 1)}</span> do preço. Acima
          de 100% não existe preço possível — qualquer valor que você cobre é consumido inteiro. Reduza a margem desejada ou as taxas.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border p-4", PROFIT.border, PROFIT.soft)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        Preço pra margem de {formatPercent(targetMargin, 1)}
      </p>
      <p className="mt-1 text-3xl font-black">{formatCurrency(a.suggested.price)}</p>
      {a.minimum.ok && (
        <p className="mt-1 text-xs text-muted">
          Piso: <span className="font-semibold text-[rgb(var(--text))]">{formatCurrency(a.minimum.price)}</span> — abaixo disso você paga
          pra vender.
        </p>
      )}
    </div>
  );
}

/** Ponto de equilíbrio e meta. Só aparecem com margem de contribuição positiva: com ela negativa,
 *  vender mais aumenta o prejuízo, e mostrar "0 vendas" diria o contrário. */
export function BreakEvenCard({ a }: { a: Analysis }) {
  const { breakEven: b, target: t } = a;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[rgb(var(--border))] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Ponto de equilíbrio</p>
        <p className="text-xs text-muted">custo fixo {formatCurrency(b.monthlyCost)}/mês</p>
      </div>

      {b.units === null ? (
        <p className="text-sm text-red-500">
          Cada venda dá prejuízo, então nenhuma quantidade paga o mês — vender mais só aumenta a perda.
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="text-2xl font-black">{b.units}</span> {b.units === 1 ? "venda" : "vendas"} só pra empatar
            {b.revenue !== null && <span className="text-muted"> · {formatCurrency(b.revenue)} de faturamento</span>}
          </p>
          {t.targetProfit > 0 && t.unitsForTarget !== null && (
            <p className="text-sm text-muted">
              Pra tirar <span className="font-semibold text-[rgb(var(--text))]">{formatCurrency(t.targetProfit)}</span> de lucro:{" "}
              <span className="font-semibold text-[rgb(var(--text))]">{t.unitsForTarget} vendas</span>
              {t.unitsBeyondBreakEven !== null && <> ({t.unitsBeyondBreakEven} depois do empate)</>}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O estrago de cada desconto.
 *
 * É a tabela que faz alguém parar de dar 20% achando que perdeu 20%: num produto de 30% de margem,
 * 20% de desconto leva mais da metade do lucro.
 */
export function DiscountTable({ discounts }: { discounts: DiscountImpact[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {discounts.map((d) => (
        <div key={d.discountPercent} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl surface-2 px-3 py-2 text-sm">
          <span className="w-12 shrink-0 font-bold">−{d.discountPercent}%</span>
          <span className="w-20 shrink-0 tabular-nums text-muted">{formatCurrency(d.newPrice)}</span>
          <span className={cn("w-20 shrink-0 tabular-nums font-semibold", toneForProfit(d.newEconomics.profit))}>
            {formatCurrency(d.newEconomics.profit)}
          </span>
          {/* Sem `truncate`: a frase cortada no meio ("+1 venda pr...") parece defeito, e é
              justamente ela que diz o que fazer com o desconto. */}
          <span className="basis-full text-xs text-muted sm:basis-auto sm:flex-1">
            {d.belowMinimum ? (
              <span className="font-semibold text-red-500">abaixo do piso</span>
            ) : (
              <>
                leva {formatPercent(d.profitLostPercent, 1)} do lucro
                {d.extraUnitsForSameProfit !== null && d.extraUnitsForSameProfit > 0 && (
                  <> · +{d.extraUnitsForSameProfit} {d.extraUnitsForSameProfit === 1 ? "venda" : "vendas"} pra compensar</>
                )}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
