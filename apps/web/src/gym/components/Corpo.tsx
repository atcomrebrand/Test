import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dumbbell, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useMuscleMap } from "../api";
import { GYM, MUSCLE_LABEL, formatVolume } from "../theme";
import { GymMuscle, MuscleLoad, MuscleWeekPoint } from "../types";
import { BodyLegend, BodyMap, MapMode, nivelDe } from "./BodyMap";
import { BodyView, MUSCLE_VIEW } from "./bodyPaths";

const JANELAS: { days: number; label: string }[] = [
  { days: 7, label: "7 dias" },
  { days: 14, label: "14 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const NIVEL_LABEL: Record<string, string> = { NENHUM: "Não treinou", POUCO: "Pouco", MEDIO: "Médio", MUITO: "Muito" };

/**
 * O mapa muscular: onde você pegou pesado, e o que você está esquecendo.
 *
 * A regra que sustenta a tela é a cor sair de **séries**, não de quilos (ver `summarizeMuscleLoad`
 * no backend). Aqui em cima ela aparece de novo na escolha do que o painel de detalhe mostra: lá
 * dentro o quilo volta, porque comparar um músculo com ele mesmo ao longo das semanas é a única
 * comparação em que quilo significa alguma coisa.
 */
export function Corpo() {
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState<MapMode>("CARGA");
  const [selected, setSelected] = useState<GymMuscle | null>(null);
  const { data, isLoading } = useMuscleMap(days);

  // A vista segue o músculo escolhido: clicar em "Costas" na lista e continuar vendo a frente
  // deixaria a seleção invisível.
  const view: BodyView = selected ? MUSCLE_VIEW[selected] : "FRONT";
  const [viewManual, setViewManual] = useState<BodyView | null>(null);
  const vistaAtual = viewManual ?? view;

  const musculos = data?.muscles ?? [];
  const detalhe = selected ? musculos.find((m) => m.muscle === selected) ?? null : null;
  const evolucao = selected ? data?.evolution[selected] ?? [] : [];

  const ordenados = useMemo(
    () =>
      [...musculos].sort((a, b) =>
        mode === "CARGA" ? b.sets - a.sets : (b.daysSince ?? 9999) - (a.daysSince ?? 9999),
      ),
    [musculos, mode],
  );

  if (isLoading) return <Skeleton className="h-[560px] rounded-3xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex rounded-xl surface-2 p-0.5">
          {(
            [
              ["CARGA", "Carga"],
              ["ATENCAO", "Atenção"],
            ] as [MapMode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                mode === value ? cn("text-neutral-900", GYM.solid) : "text-muted hover:text-[rgb(var(--text))]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {mode === "CARGA"
            ? "Quanto cada músculo foi treinado no período. Quem não treinou fica apagado no corpo."
            : "Há quanto tempo cada músculo não é treinado. Aqui quem acende é o que está sendo esquecido."}
        </p>
      </div>

      {/* A janela só existe no modo Carga: "faz quanto tempo que não treino isso" é uma pergunta
          sobre o histórico inteiro, e recortá-la em 7 dias responderia sempre "faz mais de 7". */}
      {mode === "CARGA" && (
        <div className="flex flex-wrap gap-1.5">
          {JANELAS.map((j) => (
            <button
              key={j.days}
              type="button"
              onClick={() => setDays(j.days)}
              aria-pressed={days === j.days}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                days === j.days ? cn("text-neutral-900", GYM.solid) : "surface-2 text-muted hover:brightness-95",
              )}
            >
              {j.label}
            </button>
          ))}
        </div>
      )}

      {/* Fundo neutro, e não o lima do módulo: a base do corpo (e o músculo não treinado) é cinza
          claro, e sobre o lima ela sumia — o boneco aparecia sem cabeça e sem as partes em repouso. */}
      <div className="rounded-3xl border border-[rgb(var(--border))] surface p-4">
        <div className="mb-2 flex justify-center gap-1">
          {(
            [
              ["FRONT", "Frente"],
              ["BACK", "Costas"],
            ] as [BodyView, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setViewManual(value)}
              aria-pressed={vistaAtual === value}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                vistaAtual === value ? "surface-2 shadow-sm" : "text-muted hover:surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto h-[420px] max-w-[210px]">
          <BodyMap
            view={vistaAtual}
            muscles={musculos}
            mode={mode}
            selected={selected}
            onSelect={(m) => {
              setSelected(m);
              setViewManual(null);
            }}
          />
        </div>

        <div className="mt-2">
          <BodyLegend mode={mode} />
        </div>
      </div>

      {detalhe ? (
        <DetalheMusculo musculo={detalhe} evolucao={evolucao} mode={mode} days={days} onFechar={() => setSelected(null)} />
      ) : (
        <p className="flex items-center justify-center gap-1.5 rounded-2xl surface-2 px-4 py-3 text-center text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Toque num músculo pra ver carga, séries e progressão.
        </p>
      )}

      {/* A lista existe porque a cor sozinha não é informação acessível: verde e vermelho são o par
          que some no daltonismo mais comum, e aqui o mesmo dado está escrito. Ela também alcança o
          músculo pequeno, difícil de acertar com o dedo no boneco. */}
      <div className="flex flex-col gap-1">
        {ordenados.map((m) => {
          const nivel = nivelDe(m, mode);
          return (
            <button
              key={m.muscle}
              type="button"
              onClick={() => {
                setSelected(m.muscle);
                setViewManual(null);
              }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                selected === m.muscle ? "surface-2 font-semibold" : "hover:surface-2",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: { NENHUM: "rgb(var(--text-muted) / 0.28)", POUCO: "#10B981", MEDIO: "#FBBF24", MUITO: "#EF4444" }[nivel] }}
                />
                <span className="truncate">{MUSCLE_LABEL[m.muscle]}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {mode === "CARGA"
                  ? `${m.sets.toLocaleString("pt-BR")} ${m.sets === 1 ? "série" : "séries"}`
                  : m.daysSince === null
                    ? "nunca"
                    : m.daysSince === 0
                      ? "hoje"
                      : `${m.daysSince} ${m.daysSince === 1 ? "dia" : "dias"}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetalheMusculo({
  musculo,
  evolucao,
  mode,
  days,
  onFechar,
}: {
  musculo: MuscleLoad;
  evolucao: MuscleWeekPoint[];
  mode: MapMode;
  days: number;
  onFechar: () => void;
}) {
  const nivel = nivelDe(musculo, mode);

  return (
    <div className={cn("flex flex-col gap-4 rounded-3xl border p-4", GYM.border, GYM.soft)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", GYM.text)}>{NIVEL_LABEL[nivel]}</p>
          <h3 className="text-xl font-black leading-tight">{MUSCLE_LABEL[musculo.muscle]}</h3>
        </div>
        <button onClick={onFechar} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:surface-2">
          Fechar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero label={`Séries em ${days}d`} valor={musculo.sets.toLocaleString("pt-BR")} />
        {/* Volume SEMPRE em quilos, nunca em toneladas: a conversão perde a precisão exatamente na
            faixa em que o número vive. Mesma regra do resto do módulo. */}
        <Numero label="Volume" valor={formatVolume(musculo.volume)} />
        <Numero label="Treinos" valor={String(musculo.sessions)} />
        <Numero
          label="Sem treinar"
          valor={musculo.daysSince === null ? "nunca" : musculo.daysSince === 0 ? "hoje" : `${musculo.daysSince}d`}
        />
      </div>

      {musculo.topExercise && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Dumbbell className="h-3.5 w-3.5 shrink-0" />
          Maior carga no período: <span className="font-semibold text-[rgb(var(--text))]">{musculo.topWeight} kg</span> em {musculo.topExercise}
        </p>
      )}

      {evolucao.length >= 2 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Volume por semana (12 semanas)</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={evolucao} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${musculo.muscle}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GYM.hex} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={GYM.hex} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }}
                tickFormatter={(d: string) => formatDate(d, { day: "2-digit", month: "2-digit" })}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                labelFormatter={(d: string) => `Semana de ${formatDate(d, { day: "2-digit", month: "short" })}`}
                formatter={(v: number, nome: string) => [nome === "volume" ? formatVolume(v) : v, nome === "volume" ? "Volume" : "Séries"]}
              />
              <Area type="monotone" dataKey="volume" stroke={GYM.hex} strokeWidth={2} fill={`url(#g-${musculo.muscle})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted">
          A progressão aparece a partir da segunda semana com treino desse músculo.
        </p>
      )}
    </div>
  );
}

function Numero({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl surface px-3 py-2">
      <p className="text-[11px] leading-none text-muted">{label}</p>
      <p className="mt-1 font-bold">{valor}</p>
    </div>
  );
}
