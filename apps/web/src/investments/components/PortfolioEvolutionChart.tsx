import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { usePortfolioEvolution } from "../api";
import { EvolutionRange, EvolutionResponse, EvolutionSeriesKey } from "../types";
import { usePortfolioPreference } from "../usePortfolioSort";

/**
 * Paleta Okabe–Ito: o conjunto qualitativo desenhado pra continuar separável em daltonismo
 * (deuteranopia/protanopia). Aqui não é preciosismo — o gráfico chega a ter sete linhas juntas, e
 * "verde" vs "laranja" na mesma tela é exatamente o par que some pra 8% dos homens.
 *
 * A identidade é sempre da classe, nunca da posição na lista: ligar e desligar uma linha não pode
 * repintar as que sobraram.
 */
const SERIES_COLOR: Record<EvolutionSeriesKey, string> = {
  STOCK: "#0072B2",
  FII: "#009E73",
  CRYPTO: "#E69F00",
  RENDA_FIXA: "#CC79A7",
  // Segue o tema: a carteira toda é a linha de referência, não uma cor de categoria.
  TOTAL: "rgb(var(--text))",
};

const BENCHMARK_COLOR: Record<string, string> = {
  CDI: "#6E6E7A",
  IBOV: "#D55E00",
  IFIX: "#56B4E9",
};

const RANGES: { value: EvolutionRange; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "12M", label: "12M" },
  { value: "CUSTOM", label: "Personalizado" },
];

type ChartMode = "PATRIMONIO" | "COMPARAR";

interface Props {
  /** A aba aberta na Carteira — o gráfico mostra a classe que a pessoa está olhando. */
  tab: EvolutionSeriesKey;
}

function axisTick(date: string, spanDays: number): string {
  if (spanDays > 200) return formatDate(date, { month: "short", year: "2-digit" });
  if (spanDays > 45) return formatDate(date, { day: "2-digit", month: "short" });
  return formatDate(date, { day: "2-digit", month: "2-digit" });
}

/**
 * Uma marca por rótulo distinto.
 *
 * O `minTickGap` do recharts espaça por pixel, não por texto: com o grid amostrado a cada 4 dias,
 * duas marcas caíam no mesmo mês e o eixo mostrava "jan. de 26" duas vezes seguidas — parece bug de
 * dado, e não dá pra saber qual das duas é qual. Aqui a marca só entra quando o rótulo muda de
 * verdade, então o eixo é sempre legível independente do passo do grid.
 */
function uniqueTicks(dates: string[], spanDays: number): string[] {
  const ticks: string[] = [];
  let anterior = "";
  for (const date of dates) {
    const label = axisTick(date, spanDays);
    if (label === anterior) continue;
    anterior = label;
    ticks.push(date);
  }
  return ticks;
}

/**
 * Marcas do eixo Y calculadas à mão, de 0 até um teto redondo.
 *
 * O `domain={[0, "auto"]}` do recharts não segura o piso: ele arredonda o eixo pros dois lados e
 * abria um "−3k" embaixo do zero num gráfico de patrimônio, que nunca é negativo. Aqui o zero é o
 * zero, e o topo é o próximo múltiplo redondo acima do maior valor.
 */
function currencyTicks(max: number, count = 6): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const bruto = max / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(bruto)));
  // Sem 2,5 na lista: um passo de 2500 rende marcas em 2,5k e 7,5k, que arredondam pra "3k" e
  // "8k" no formato compacto e viram dois rótulos mentirosos no eixo.
  const passo = [1, 2, 5, 10].map((m) => m * magnitude).find((p) => p >= bruto) ?? 10 * magnitude;
  const topo = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = 0; v <= topo + passo / 2; v += passo) ticks.push(Math.round(v));
  return ticks;
}

function compactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid rgb(var(--border))",
  background: "rgb(var(--surface))",
  fontSize: 13,
} as const;

interface TooltipPayloadItem {
  payload: { date: string; valor: number; investido: number; lucro: number };
}

/**
 * Tooltip do modo Patrimônio.
 *
 * Escrito à mão porque o lucro não é uma série desenhada — ele é a distância entre as duas linhas.
 * O formatter padrão do recharts só sabe listar o que foi plotado, e a tentativa de contrabandear
 * uma linha transparente só pra ele aparecer no tooltip não funciona (o recharts descarta a série
 * invisível). Aqui os três números saem do mesmo ponto do dado, que é de onde eles vêm mesmo.
 */
function PatrimonyTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const { date, valor, investido, lucro } = payload[0].payload;

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] surface px-3 py-2 text-[13px] shadow-lg">
      <p className="mb-1 font-semibold">{formatDate(date, { day: "2-digit", month: "short", year: "numeric" })}</p>
      <p className="flex justify-between gap-4">
        <span className="text-muted">Valor</span>
        <span className="font-semibold">{formatCurrency(valor)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted">Investido</span>
        <span>{formatCurrency(investido)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted">Lucro</span>
        <span className={cn("font-semibold", lucro >= 0 ? "text-emerald-500" : "text-red-500")}>
          {lucro >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(lucro))}
        </span>
      </p>
    </div>
  );
}

/** Chip que serve de legenda e de liga/desliga ao mesmo tempo — a bolinha colorida ao lado do nome
 *  é o que garante que a identidade nunca dependa só da cor da linha. */
function SeriesChip({
  label,
  color,
  dashed,
  active,
  disabled,
  locked,
  hint,
  onClick,
}: {
  label: string;
  color: string;
  dashed?: boolean;
  active: boolean;
  disabled?: boolean;
  /** Ligada e sem botão de desligar (a aba aberta). Travada não é o mesmo que indisponível: a
   *  linha em destaque no gráfico não pode aparecer apagada na legenda. */
  locked?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || locked}
      title={hint}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-[rgb(var(--border))] surface-2 font-semibold"
          : "border-transparent text-muted hover:surface-2",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
        locked && "cursor-default",
      )}
      aria-pressed={active}
    >
      <span
        aria-hidden
        className="h-0.5 w-4 shrink-0 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` }
            : { backgroundColor: color }
        }
      />
      {label}
    </button>
  );
}

export function PortfolioEvolutionChart({ tab }: Props) {
  const [range, setRange] = usePortfolioPreference<EvolutionRange>("evolution-range", "12M");
  const [mode, setMode] = usePortfolioPreference<ChartMode>("evolution-mode", "PATRIMONIO");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [extras, setExtras] = useState<Set<string>>(new Set(["CDI"]));

  const { data, isLoading } = usePortfolioEvolution(
    range === "CUSTOM" ? { range, from: custom.from || undefined, to: custom.to || undefined } : { range },
  );

  const atual = data?.series.find((s) => s.key === tab);
  const spanDays = data ? (Date.parse(data.to) - Date.parse(data.from)) / 86_400_000 : 0;

  const patrimonio = useMemo(
    () =>
      (atual?.points ?? []).map((p) => ({
        date: p.date,
        valor: p.value,
        investido: p.invested,
        lucro: p.profit,
      })),
    [atual],
  );

  const patrimonioTicks = useMemo(
    () => currencyTicks(Math.max(0, ...patrimonio.map((p) => Math.max(p.valor, p.investido)))),
    [patrimonio],
  );

  const comparacao = useMemo(() => buildComparison(data, tab, extras), [data, tab, extras]);

  // O período personalizado só consulta quando as duas datas existem — e é justamente por isso que
  // o cabeçalho não pode ficar atrás do skeleton: era ele que continha os campos de data, então
  // escolher "Personalizado" escondia os campos que precisavam ser preenchidos pra sair do
  // carregando. Só a área do gráfico espera; os controles ficam sempre na tela.
  const aguardandoDatas = range === "CUSTOM" && (!custom.from || !custom.to);
  const carregando = isLoading || !data;
  const semHistorico = atual?.withoutHistory ?? [];
  const lucroPositivo = (atual?.profit ?? 0) >= 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-muted" />
            <div className="flex rounded-lg surface-2 p-0.5">
              {(
                [
                  ["PATRIMONIO", "Patrimônio"],
                  ["COMPARAR", "Comparar"],
                ] as [ChartMode, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    mode === value ? "surface shadow-sm" : "text-muted hover:text-[rgb(var(--text))]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r.value ? "surface-2 font-semibold" : "text-muted hover:surface-2",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {range === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <input
              type="date"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className="rounded-lg border border-[rgb(var(--border))] surface px-2 py-1"
            />
            até
            <input
              type="date"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="rounded-lg border border-[rgb(var(--border))] surface px-2 py-1"
            />
          </div>
        )}

        {aguardandoDatas ? (
          <p className="py-12 text-center text-sm text-muted">
            Escolha a data inicial e a final acima pra montar o gráfico do período.
          </p>
        ) : carregando ? (
          <Skeleton className="h-[300px]" />
        ) : mode === "PATRIMONIO" ? (
          <>
            {/* Os três números que o gráfico responde, antes do gráfico: quem só quer o saldo não
                precisa passar o mouse em ponto nenhum. */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div>
                <p className="text-[11px] leading-none text-muted">Valor hoje</p>
                <p className="text-2xl font-bold">{formatCurrency(atual?.value ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] leading-none text-muted">Investido</p>
                <p className="font-semibold">{formatCurrency(atual?.invested ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] leading-none text-muted">Lucro</p>
                <p className={cn("font-semibold", lucroPositivo ? "text-emerald-500" : "text-red-500")}>
                  {lucroPositivo ? "+" : "−"}
                  {formatCurrency(Math.abs(atual?.profit ?? 0))}
                </p>
              </div>
              <div>
                <p className="text-[11px] leading-none text-muted">Rentabilidade</p>
                <p className={cn("font-semibold", (atual?.returnPercent ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {formatPercent(atual?.returnPercent, 2)}
                </p>
              </div>
            </div>

            {atual?.hasData ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={patrimonio} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evolutionValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SERIES_COLOR[tab]} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={SERIES_COLOR[tab]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                  <XAxis
                    dataKey="date"
                    ticks={uniqueTicks(patrimonio.map((p) => p.date), spanDays)}
                    tickFormatter={(v: string) => axisTick(v, spanDays)}
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  {/* Patrimônio não fica negativo: o eixo começa no zero e termina num número
                      redondo, em vez de sobrar espaço morto embaixo da linha. */}
                  <YAxis
                    domain={[0, patrimonioTicks[patrimonioTicks.length - 1]]}
                    ticks={patrimonioTicks}
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={compactCurrency}
                    width={48}
                  />
                  <Tooltip content={<PatrimonyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    name="Valor"
                    stroke={SERIES_COLOR[tab]}
                    strokeWidth={2}
                    fill="url(#evolutionValue)"
                  />
                  {/* A distância entre as duas linhas É o lucro. Plotar o lucro como terceira série
                      no mesmo eixo deixaria uma reta colada no zero, porque ele é uma ordem de
                      grandeza menor que o patrimônio — e dois eixos Y é pior ainda. */}
                  <Line
                    type="monotone"
                    dataKey="investido"
                    name="Investido"
                    stroke="rgb(var(--text-muted))"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted">
                {semHistorico.length > 0
                  ? "Nenhum ativo dessa aba tem histórico de preço disponível — sem isso não dá pra remontar o passado da carteira."
                  : "Sem movimentação nesse período — cadastre uma compra ou escolha um intervalo maior."}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SERIES_COLOR[tab] }} />
                Valor de mercado
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded-full"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, rgb(var(--text-muted)) 0 4px, transparent 4px 7px)",
                  }}
                />
                Investido (custo) — a distância até a linha cheia é o lucro
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">
              Rentabilidade acumulada no período, tudo na mesma base. Aporte não conta como ganho — cada linha mede só
              o que o dinheiro rendeu, então dá pra comparar com o CDI mesmo tendo investido no meio do caminho.
            </p>

            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={comparacao.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis
                  dataKey="date"
                  ticks={uniqueTicks(comparacao.rows.map((r) => String(r.date)), spanDays)}
                  tickFormatter={(v: string) => axisTick(v, spanDays)}
                  tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                  width={48}
                />
                {/* O zero é a referência: acima rendeu, abaixo perdeu. */}
                <ReferenceLine y={0} stroke="rgb(var(--border))" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short", year: "numeric" })}
                  formatter={(value: number, name: string) => [formatPercent(value, 2), name]}
                />
                {comparacao.lines.map((l) => (
                  <Line
                    key={l.dataKey}
                    type="monotone"
                    dataKey={l.dataKey}
                    name={l.label}
                    stroke={l.color}
                    strokeWidth={l.emphasis ? 2.5 : 2}
                    strokeDasharray={l.dashed ? "5 4" : undefined}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap items-center gap-1">
              {(data?.series ?? []).map((s) => (
                <SeriesChip
                  key={s.key}
                  label={`${s.label}${s.returnPercent !== null ? ` ${s.returnPercent >= 0 ? "+" : ""}${s.returnPercent.toFixed(1)}%` : ""}`}
                  color={SERIES_COLOR[s.key]}
                  active={s.key === tab || extras.has(s.key)}
                  disabled={!s.hasData && s.key !== tab}
                  locked={s.key === tab}
                  hint={
                    !s.hasData
                      ? "Sem posição nesse período"
                      : s.key === tab
                        ? "A aba aberta fica sempre no gráfico"
                        : undefined
                  }
                  onClick={() => setExtras((prev) => toggle(prev, s.key))}
                />
              ))}
              {(data?.benchmarks ?? []).map((b) => (
                <SeriesChip
                  key={b.key}
                  label={`${b.label}${b.returnPercent !== null ? ` ${b.returnPercent >= 0 ? "+" : ""}${b.returnPercent.toFixed(1)}%` : ""}`}
                  color={BENCHMARK_COLOR[b.key]}
                  dashed
                  active={extras.has(b.key)}
                  disabled={!b.available}
                  hint={!b.available ? "Índice indisponível na fonte agora" : undefined}
                  onClick={() => setExtras((prev) => toggle(prev, b.key))}
                />
              ))}
            </div>
          </>
        )}

        {/* Ativo sem histórico não entra na linha. Dizer isso evita a leitura errada de que o
            patrimônio caiu — mesmo aviso que já existe no total abaixo das abas. */}
        {!carregando && semHistorico.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sem histórico de preço: {semHistorico.join(", ")} — fora do gráfico.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function toggle(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

interface ComparisonLine {
  dataKey: string;
  label: string;
  color: string;
  dashed?: boolean;
  emphasis?: boolean;
}

/**
 * Monta as linhas do modo "Comparar" a partir do índice base 100 que o servidor já calculou.
 *
 * O que vai pro gráfico é `índice − 100`, ou seja a variação em % — "112,4" não diz nada sozinho,
 * "+12,4%" diz tudo. A aba aberta entra sempre e com traço mais grosso: é a linha que a pessoa
 * veio ver, as outras é que são o pano de fundo.
 */
function buildComparison(
  data: EvolutionResponse | undefined,
  tab: EvolutionSeriesKey,
  extras: Set<string>,
): { rows: Record<string, string | number | null>[]; lines: ComparisonLine[] } {
  if (!data) return { rows: [], lines: [] };

  const lines: ComparisonLine[] = [];
  const rows: Record<string, string | number | null>[] = data.series[0]?.points.map((p) => ({ date: p.date })) ?? [];

  for (const s of data.series) {
    if (!s.hasData) continue;
    if (s.key !== tab && !extras.has(s.key)) continue;
    const key = `s_${s.key}`;
    lines.push({ dataKey: key, label: s.label, color: SERIES_COLOR[s.key], emphasis: s.key === tab });
    s.points.forEach((p, i) => {
      if (rows[i]) rows[i][key] = p.index - 100;
    });
  }

  for (const b of data.benchmarks) {
    if (!b.available || !extras.has(b.key)) continue;
    const key = `b_${b.key}`;
    lines.push({ dataKey: key, label: b.label, color: BENCHMARK_COLOR[b.key], dashed: true });
    b.points.forEach((p, i) => {
      if (rows[i]) rows[i][key] = p.index === null ? null : p.index - 100;
    });
  }

  return { rows, lines };
}
