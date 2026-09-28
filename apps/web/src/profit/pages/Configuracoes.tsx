import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  useCreateFixedCost,
  useFixedCosts,
  useProfitSettings,
  useRemoveFixedCost,
  useUpdateProfitSettings,
} from "../api";
import { PROFIT } from "../theme";
import { ProfitTaxMode } from "../types";

export default function Configuracoes() {
  const { data: settings, isLoading } = useProfitSettings();
  const { data: custos } = useFixedCosts();
  const atualizar = useUpdateProfitSettings();
  const criar = useCreateFixedCost();
  const remover = useRemoveFixedCost();

  const [taxPercent, setTaxPercent] = useState("0");
  const [taxMonthly, setTaxMonthly] = useState("0");
  const [margem, setMargem] = useState("20");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (!settings) return;
    setTaxPercent(String(Number(settings.taxPercent)));
    setTaxMonthly(String(Number(settings.taxMonthly)));
    setMargem(String(Number(settings.defaultMarginPercent)));
  }, [settings]);

  if (isLoading || !settings) return <Skeleton className="h-64 rounded-2xl" />;

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")) || 0);
  const totalFixo = (custos ?? []).filter((c) => c.active).reduce((acc, c) => acc + Number(c.amount), 0);
  const fixoComDas = totalFixo + (settings.taxEnabled && settings.taxMode === "FIXED" ? Number(settings.taxMonthly) : 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Configurações" description="Imposto e custos fixos — os dois entram em todo cálculo do módulo." />

      <Card>
        <CardHeader>
          <CardTitle>Imposto</CardTitle>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.taxEnabled}
              onChange={(e) => atualizar.mutate({ taxEnabled: e.target.checked })}
              className="h-4 w-4 accent-teal-600"
            />
            {settings.taxEnabled ? "Ligado" : "Desligado"}
          </label>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!settings.taxEnabled ? (
            <p className="text-sm text-muted">
              Desligado, o imposto não entra em conta nenhuma. Ligue quando começar a recolher — os campos ficam guardados.
            </p>
          ) : (
            <>
              {/* Os dois modos caem em lugares DIFERENTES da conta, e é por isso que são exclusivos:
                  percentual entra no preço de cada venda; valor fixo vira custo do mês. */}
              <div className="flex rounded-lg surface-2 p-0.5">
                {(
                  [
                    ["PERCENT", "% sobre o faturamento"],
                    ["FIXED", "Valor fixo por mês"],
                  ] as [ProfitTaxMode, string][]
                ).map(([modo, label]) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => atualizar.mutate({ taxMode: modo })}
                    aria-pressed={settings.taxMode === modo}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      settings.taxMode === modo ? "surface shadow-sm" : "text-muted hover:text-[rgb(var(--text))]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settings.taxMode === "PERCENT" ? (
                <>
                  <Input
                    label="Alíquota (%)"
                    inputMode="decimal"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    onBlur={() => atualizar.mutate({ taxPercent: num(taxPercent) })}
                  />
                  <p className="text-xs text-muted">
                    Entra no preço de cada venda — é exatamente aqui que a conta de somar percentuais erra, porque o imposto incide sobre
                    o preço e não sobre o custo.
                  </p>
                </>
              ) : (
                <>
                  <Input
                    label="Valor mensal (R$)"
                    inputMode="decimal"
                    value={taxMonthly}
                    onChange={(e) => setTaxMonthly(e.target.value)}
                    onBlur={() => atualizar.mutate({ taxMonthly: num(taxMonthly) })}
                  />
                  <p className="text-xs text-muted">
                    Não muda o preço de nada: vira custo fixo do mês e aparece no ponto de equilíbrio. Rateá-lo por unidade exigiria saber
                    de antemão quantas você vai vender — que é justamente a pergunta.
                  </p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custos fixos do mês</CardTitle>
          <span className={cn("text-sm font-bold", PROFIT.text)}>{formatCurrency(fixoComDas)}</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            O que vence todo mês mesmo sem vender nada. É o que transforma “quantas vendas somam R$ X” em “quantas vendas pagam o mês e
            ainda sobram R$ X”.
          </p>

          <div className="flex flex-col divide-y divide-[rgb(var(--border))]">
            {(custos ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{c.name}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{formatCurrency(Number(c.amount))}</span>
                  <button onClick={() => remover.mutate(c.id)} aria-label={`Remover ${c.name}`} className="rounded-lg p-1.5 text-muted hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            ))}
            {settings.taxEnabled && settings.taxMode === "FIXED" && Number(settings.taxMonthly) > 0 && (
              <div className="flex items-center justify-between gap-3 py-2 text-sm text-muted">
                <span>Imposto fixo mensal</span>
                <span className="tabular-nums">{formatCurrency(Number(settings.taxMonthly))}</span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" />
            <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="w-32" />
            <Button
              disabled={!nome.trim()}
              loading={criar.isPending}
              onClick={() => criar.mutate({ name: nome.trim(), amount: num(valor) }, { onSuccess: () => { setNome(""); setValor(""); } })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Margem desejada padrão</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input
            label="Margem (%)"
            inputMode="decimal"
            value={margem}
            onChange={(e) => setMargem(e.target.value)}
            onBlur={() => atualizar.mutate({ defaultMarginPercent: num(margem) })}
            hint="Usada quando o produto não define a sua"
          />
        </CardContent>
      </Card>
    </div>
  );
}
