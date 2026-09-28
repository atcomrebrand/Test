import { FormEvent, useEffect, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/format";
import { useProfitChannels, useProfitSettings, useSimulate } from "../api";
import { BreakEvenCard, CostBreakdown, DiscountTable, SuggestedPrice, ThreeNumbers } from "../components/Economics";
import { formatPercent } from "../theme";

/** Campo numérico com rascunho local: apagar tem que deixar vazio, não voltar pra zero. Mesma
 *  correção que os campos da Academia precisaram. */
function useNumberField(inicial: string) {
  const [texto, setTexto] = useState(inicial);
  const valor = texto.trim() === "" ? 0 : Number(texto.replace(",", "."));
  return { texto, setTexto, valor: Number.isFinite(valor) ? valor : 0 };
}

/**
 * A calculadora avulsa: nada é gravado.
 *
 * É a tela de entrada do módulo de propósito. A pergunta mais comum é sobre um produto que você
 * **ainda não comprou** — obrigar a cadastrar antes de simular transformaria uma conta de dez
 * segundos num cadastro.
 */
export default function Calculadora() {
  const { data: settings } = useProfitSettings();
  const { data: canais } = useProfitChannels();
  const simular = useSimulate();

  const custo = useNumberField("50");
  const embalagem = useNumberField("0");
  const frete = useNumberField("0");
  const taxaPercent = useNumberField("0");
  const taxaFixa = useNumberField("0");
  const devolucao = useNumberField("0");
  const margem = useNumberField("20");
  const meta = useNumberField("0");
  const [preco, setPreco] = useState("");
  const [canalId, setCanalId] = useState("");

  // A margem desejada começa na padrão das configurações: o número que a pessoa já decidiu uma vez
  // não deveria precisar ser redigitado a cada simulação.
  useEffect(() => {
    if (settings) margem.setTexto(String(Number(settings.defaultMarginPercent)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultMarginPercent]);

  /** Escolher um canal preenche as taxas dele — e continua editável, porque a simulação serve
   *  justamente pra testar "e se a taxa fosse outra". */
  function aplicarCanal(id: string) {
    setCanalId(id);
    const c = canais?.find((x) => x.id === id);
    if (!c) return;
    taxaPercent.setTexto(String(Number(c.feePercent)));
    taxaFixa.setTexto(String(Number(c.feeFixed)));
    frete.setTexto(String(Number(c.shippingCost)));
    devolucao.setTexto(String(Number(c.returnRatePercent)));
  }

  function calcular(e: FormEvent) {
    e.preventDefault();
    simular.mutate({
      cost: custo.valor,
      packagingCost: embalagem.valor,
      shippingCost: frete.valor,
      feePercent: taxaPercent.valor,
      feeFixed: taxaFixa.valor,
      returnRatePercent: devolucao.valor,
      targetMarginPercent: margem.valor,
      targetProfit: meta.valor,
      ...(preco.trim() === "" ? {} : { price: Number(preco.replace(",", ".")) }),
    });
  }

  const r = simular.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Calculadora" description="Simule um produto sem cadastrar nada. Preço, lucro, ponto de equilíbrio e desconto." />

      <Card>
        <CardContent className="py-4">
          <form onSubmit={calcular} className="flex flex-col gap-4">
            {(canais?.length ?? 0) > 0 && (
              <Select
                label="Usar as taxas de um canal (opcional)"
                value={canalId}
                onChange={(e) => aplicarCanal(e.target.value)}
                options={[{ value: "", label: "Preencher à mão" }, ...(canais ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="Custo do produto (R$)" inputMode="decimal" value={custo.texto} onChange={(e) => custo.setTexto(e.target.value)} />
              <Input label="Embalagem (R$)" inputMode="decimal" value={embalagem.texto} onChange={(e) => embalagem.setTexto(e.target.value)} />
              <Input
                label="Frete que você paga (R$)"
                inputMode="decimal"
                value={frete.texto}
                onChange={(e) => frete.setTexto(e.target.value)}
                hint="O frete pago pelo cliente não entra"
              />
              <Input label="Taxa do canal (%)" inputMode="decimal" value={taxaPercent.texto} onChange={(e) => taxaPercent.setTexto(e.target.value)} />
              <Input label="Taxa fixa por pedido (R$)" inputMode="decimal" value={taxaFixa.texto} onChange={(e) => taxaFixa.setTexto(e.target.value)} />
              <Input label="Devolução esperada (%)" inputMode="decimal" value={devolucao.texto} onChange={(e) => devolucao.setTexto(e.target.value)} />
              <Input label="Margem desejada (%)" inputMode="decimal" value={margem.texto} onChange={(e) => margem.setTexto(e.target.value)} />
              <Input
                label="Preço de venda (R$)"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                hint="Vazio = usa o preço sugerido"
              />
              <Input label="Meta de lucro no mês (R$)" inputMode="decimal" value={meta.texto} onChange={(e) => meta.setTexto(e.target.value)} />
            </div>

            <Button type="submit" loading={simular.isPending}>
              <Calculator className="h-4 w-4" />
              Calcular
            </Button>
          </form>
        </CardContent>
      </Card>

      {r && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SuggestedPrice a={r} targetMargin={r.targetMarginPercent} />
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                  {r.priceIsSuggested ? "Analisando o preço sugerido" : `Analisando ${formatCurrency(r.economics.price)}`}
                </p>
                <ThreeNumbers e={r.economics} />
                <CostBreakdown e={r.economics} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <BreakEvenCard a={r} />
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Se você der desconto</p>
                <DiscountTable discounts={r.discounts} />
              </CardContent>
            </Card>
            {r.context.taxPercent > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Imposto de {formatPercent(r.context.taxPercent, 2)} sobre o faturamento já entra no preço. O DAS fixo, quando é o caso, entra
                no custo do mês em vez do preço.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
