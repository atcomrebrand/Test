import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Calculator, PiggyBank, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useContributionSimulation,
  useFixedIncomeSimulation,
  useSimulationRates,
} from "../api";
import { useDebounced } from "../useDebounced";

const TABS = [
  { value: "RENDA_FIXA", label: "Renda fixa" },
  { value: "APORTE", label: "Aporte mensal" },
];

const TIPOS = [
  { value: "CDB", label: "CDB" },
  { value: "LCI", label: "LCI (isenta de IR)" },
  { value: "LCA", label: "LCA (isenta de IR)" },
  { value: "TESOURO", label: "Tesouro" },
];

const INDEXADORES = [
  { value: "POS_FIXADO_CDI", label: "% do CDI" },
  { value: "PREFIXADO", label: "Prefixado (% a.a.)" },
  { value: "IPCA_MAIS", label: "IPCA + (% a.a.)" },
];

function numero(valor: string, padrao = 0): number {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function Numero({ label, valor, tom, sub }: { label: string; valor: string; tom?: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] leading-none text-muted">{label}</p>
      <p className={cn("mt-0.5 font-bold", tom ?? "")}>{valor}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** Aviso de projeção. Some quando o app conseguiu o número oficial, e vira âmbar quando não —
 *  mesma linguagem do aviso da Renda Fixa, porque é o mesmo tipo de ressalva. */
function AvisoDeProjecao({ official, cdi }: { official: boolean; cdi: number }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-xl p-2.5 text-xs",
        official ? "surface-2 text-muted" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      {official ? (
        <>
          Projeção com o CDI de hoje ({cdi.toFixed(2)}% a.a.) repetido pro período inteiro. O imposto é calculado
          pelas mesmas regras que a tela de Renda Fixa usa; a taxa futura, ninguém sabe.
        </>
      ) : (
        <>
          Não deu pra buscar as taxas no Banco Central agora, então a conta usou valores de reserva — em uma
          projeção de anos isso muda o resultado em milhares de reais. Tente de novo mais tarde.
        </>
      )}
    </p>
  );
}

function RendaFixa() {
  const [amount, setAmount] = useState("10000");
  const [months, setMonths] = useState("24");
  const [type, setType] = useState("CDB");
  const [indexer, setIndexer] = useState("POS_FIXADO_CDI");
  const [taxa, setTaxa] = useState("110");

  const params = useDebounced(
    useMemo(() => {
      const valor = numero(amount);
      const prazo = Math.round(numero(months));
      if (valor <= 0 || prazo < 1) return null;
      return {
        amount: valor,
        months: Math.min(prazo, 600),
        type,
        indexer,
        ...(indexer === "POS_FIXADO_CDI" ? { cdiPercent: numero(taxa) } : { fixedRatePercent: numero(taxa) }),
      };
    }, [amount, months, type, indexer, taxa]),
  );

  const { data, isLoading } = useFixedIncomeSimulation(params);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Input label="Quanto aplicar" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Prazo (meses)" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        <Select label="Tipo" options={TIPOS} value={type} onChange={(e) => setType(e.target.value)} />
        <Select label="Rende" options={INDEXADORES} value={indexer} onChange={(e) => setIndexer(e.target.value)} />
        <Input
          label={indexer === "POS_FIXADO_CDI" ? "% do CDI" : "% ao ano"}
          inputMode="decimal"
          value={taxa}
          onChange={(e) => setTaxa(e.target.value)}
        />
      </div>

      {!params && <p className="text-sm text-muted">Preencha valor e prazo pra simular.</p>}
      {params && (isLoading || !data) && <Skeleton className="h-56" />}

      {params && data && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                <Numero
                  label="Você resgata"
                  valor={formatCurrency(data.result.netValue)}
                  tom="text-2xl text-emerald-600 dark:text-emerald-400"
                  sub={`em ${formatDate(data.result.maturityDate)} · ${data.result.days} dias`}
                />
                <Numero label="Aplicado" valor={formatCurrency(data.result.invested)} />
                <Numero
                  label="Rendimento líquido"
                  valor={`+${formatCurrency(data.result.netYield)}`}
                  tom="text-emerald-600 dark:text-emerald-400"
                  sub={`${data.result.netPercent.toFixed(2)}% no período`}
                />
                <Numero
                  label="Equivale a"
                  valor={`${data.result.netAnnualPercent.toFixed(2)}% a.a.`}
                  sub="líquido, já sem imposto"
                />
              </div>

              {/* O caminho do dinheiro: bruto, o que o governo leva, o que sobra. É o que a
                  simulação tem de diferente de uma conta de juros composta qualquer. */}
              <div className="surface-2 grid grid-cols-2 gap-3 rounded-xl p-3 sm:grid-cols-4">
                <Numero label="Bruto" valor={formatCurrency(data.result.grossValue)} />
                <Numero label={`IR (${data.result.irRate}%)`} valor={`−${formatCurrency(data.result.irAmount)}`} tom="text-red-500" />
                <Numero
                  label={`IOF (${data.result.iofRate}%)`}
                  valor={data.result.iofAmount > 0 ? `−${formatCurrency(data.result.iofAmount)}` : "—"}
                  tom={data.result.iofAmount > 0 ? "text-red-500" : "text-muted"}
                  sub={data.result.iofAmount > 0 ? "resgate antes de 30 dias" : undefined}
                />
                <Numero label="Líquido" valor={formatCurrency(data.result.netValue)} />
              </div>
            </CardContent>
          </Card>

          {/* Simular um papel sozinho responde "quanto rende" e deixa de fora "vale a pena". */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.benchmarks.map((b) => {
              const diferenca = data.result.netValue - b.result.netValue;
              return (
                <Card key={b.label}>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.label}</p>
                      <p className="text-xs text-muted">
                        {formatCurrency(b.result.netValue)} · {b.result.netAnnualPercent.toFixed(2)}% a.a.
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        diferenca >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                      )}
                    >
                      {diferenca >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(diferenca))}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <AvisoDeProjecao official={data.rates.official} cdi={data.rates.cdiAnnual} />
        </>
      )}
    </div>
  );
}

function Aporte() {
  const { data: rates } = useSimulationRates();
  const [initial, setInitial] = useState("1000");
  const [monthly, setMonthly] = useState("500");
  const [anos, setAnos] = useState("10");
  const [taxa, setTaxa] = useState("");
  const [meta, setMeta] = useState("");

  // Campo vazio segue o CDI de hoje: abrir a tela já com o número real vale mais que um chute
  // redondo, e quem quiser testar outro cenário é só digitar por cima.
  const taxaEfetiva = taxa.trim() === "" ? (rates?.cdiAnnual ?? 0) : numero(taxa);

  const params = useDebounced(
    useMemo(() => {
      const meses = Math.round(numero(anos) * 12);
      if (meses < 1 || taxaEfetiva <= 0) return null;
      const alvo = numero(meta);
      return {
        initialAmount: numero(initial),
        monthlyAmount: numero(monthly),
        annualRatePercent: taxaEfetiva,
        months: Math.min(meses, 600),
        ...(alvo > 0 ? { target: alvo } : {}),
      };
    }, [initial, monthly, anos, taxaEfetiva, meta]),
  );

  const { data, isLoading } = useContributionSimulation(params);

  // Um ponto por ano no gráfico: 120 pontos mensais não mostram nada que 10 anuais não mostrem, e
  // o tooltip fica impossível de acertar no celular.
  const serie = useMemo(
    () =>
      (data?.points ?? [])
        .filter((p) => p.month % 12 === 0)
        .map((p) => ({ ano: p.month / 12, aportado: p.contributed, juros: p.interest })),
    [data],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Input label="Valor inicial" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} />
        <Input label="Aporte mensal" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <Input label="Por quantos anos" inputMode="decimal" value={anos} onChange={(e) => setAnos(e.target.value)} />
        <Input
          label="Taxa (% a.a.)"
          inputMode="decimal"
          value={taxa}
          onChange={(e) => setTaxa(e.target.value)}
          placeholder={rates ? `CDI hoje: ${rates.cdiAnnual.toFixed(2)}` : "CDI de hoje"}
        />
        <Input label="Meta (opcional)" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} />
      </div>

      {!params && <p className="text-sm text-muted">Preencha prazo e taxa pra simular.</p>}
      {params && (isLoading || !data) && <Skeleton className="h-72" />}

      {params && data && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                <Numero label="Você chega em" valor={formatCurrency(data.total)} tom="text-2xl" />
                <Numero label="Do seu bolso" valor={formatCurrency(data.contributed)} />
                <Numero
                  label="Juros"
                  valor={`+${formatCurrency(data.interest)}`}
                  tom="text-emerald-600 dark:text-emerald-400"
                  sub={`${data.interestShare.toFixed(0)}% do total`}
                />
                {data.monthsToTarget !== null && (
                  <Numero
                    label="Alcança a meta em"
                    valor={
                      data.monthsToTarget >= 12
                        ? `${Math.floor(data.monthsToTarget / 12)}a ${data.monthsToTarget % 12}m`
                        : `${data.monthsToTarget} meses`
                    }
                  />
                )}
              </div>

              <ResponsiveContainer width="100%" height={260}>
                {/* Empilhado de propósito: a altura total é o patrimônio, e a fatia de cima é o
                    juro. Duas linhas soltas obrigariam a subtrair de cabeça pra ver isso. */}
                <AreaChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                  <XAxis
                    dataKey="ano"
                    tickFormatter={(v: number) => (v === 0 ? "hoje" : `${v}a`)}
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name === "aportado" ? "Do seu bolso" : "Juros"]}
                    labelFormatter={(v: number) => (v === 0 ? "Hoje" : `Em ${v} ano${v > 1 ? "s" : ""}`)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgb(var(--border))",
                      background: "rgb(var(--surface))",
                      fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="aportado" stackId="1" stroke="#0072B2" fill="#0072B2" fillOpacity={0.35} strokeWidth={2} />
                  <Area type="monotone" dataKey="juros" stackId="1" stroke="#009E73" fill="#009E73" fillOpacity={0.35} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-3 rounded-sm" style={{ backgroundColor: "#0072B2" }} /> Do seu bolso
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-3 rounded-sm" style={{ backgroundColor: "#009E73" }} /> Juros
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="surface-2 flex items-start gap-1.5 rounded-xl p-2.5 text-xs text-muted">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            Taxa constante e sem imposto: é uma projeção de quanto o tempo rende, não a previsão de um papel
            específico. Pra ver o imposto mordendo, use a aba de renda fixa.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Simuladores do módulo de Investimentos.
 *
 * Os dois olham pra frente, onde não existe série do CDI pra consultar — então tudo aqui é a taxa
 * de hoje repetida pro período, e as duas abas dizem isso na tela. O que **não** é projeção é o
 * imposto: a aba de renda fixa usa a mesma função que a tela de Renda Fixa usa pra bater cent a
 * cent com o extrato do banco.
 */
export default function Simular() {
  const [tab, setTab] = useState("RENDA_FIXA");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Calculator className="h-5 w-5 text-muted" />
          Simular
        </h1>
        <p className="text-sm text-muted">
          {tab === "RENDA_FIXA"
            ? "Quanto um papel rende até o vencimento, com IR e IOF descontados — e se ele ganha da poupança."
            : "Onde você chega guardando todo mês, e quanto disso é juro em vez de aporte."}
        </p>
      </div>

      <Tabs value={tab} onChange={setTab} options={TABS} />

      {tab === "RENDA_FIXA" ? <RendaFixa /> : <Aporte />}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        {tab === "RENDA_FIXA" ? <PiggyBank className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
        Nada aqui é gravado — simular não mexe na sua carteira.
      </p>
    </div>
  );
}
