import { cn } from "@/lib/cn";
import { GymMuscle, MuscleLoad } from "../types";
import { MUSCLE_LABEL } from "../theme";
import { BODY, BodyView, NEUTRAL_SHAPES } from "./bodyPaths";

export type MapMode = "CARGA" | "ATENCAO";

/**
 * As cores do mapa.
 *
 * Semáforo, como o resto do mundo do treino usa — mas o verde e o vermelho são justamente o par que
 * some no daltonismo mais comum, então a cor nunca é a única informação: a intensidade também
 * aparece no texto da legenda, na lista abaixo do boneco e no painel de detalhe.
 */
const CORES: Record<string, { fill: string; stroke: string }> = {
  NENHUM: { fill: "rgb(var(--surface-2))", stroke: "rgb(var(--border))" },
  POUCO: { fill: "#10B981", stroke: "#059669" },
  MEDIO: { fill: "#FBBF24", stroke: "#D97706" },
  MUITO: { fill: "#EF4444", stroke: "#DC2626" },
};

/**
 * O nível de cada músculo, conforme o modo.
 *
 * **Carga** é a pergunta "onde eu peguei pesado": o não treinado fica vazio, e a cor sobe com o
 * volume de séries. **Atenção** é a pergunta oposta, "o que estou esquecendo": aí quem acende é o
 * abandonado, e o em dia é que fica discreto. São perguntas diferentes com respostas invertidas, e
 * por isso o mesmo boneco serve as duas sem nenhuma ambiguidade — o seletor diz qual está no ar.
 */
export function nivelDe(m: MuscleLoad, mode: MapMode): keyof typeof CORES {
  if (mode === "CARGA") return m.intensity;
  // Nunca treinado é o caso mais grave, não a ausência de caso.
  if (m.daysSince === null) return "MUITO";
  if (m.daysSince >= 14) return "MUITO";
  if (m.daysSince >= 7) return "MEDIO";
  return "POUCO";
}

interface Props {
  view: BodyView;
  muscles: MuscleLoad[];
  mode: MapMode;
  selected: GymMuscle | null;
  onSelect: (muscle: GymMuscle) => void;
}

export function BodyMap({ view, muscles, mode, selected, onSelect }: Props) {
  const porMusculo = new Map(muscles.map((m) => [m.muscle, m]));

  return (
    <svg viewBox="0 0 200 420" className="h-full w-full" role="group" aria-label={view === "FRONT" ? "Corpo de frente" : "Corpo de costas"}>
      {/* A base não recebe toque: sem isso ela rouba o clique no vão entre as duas metades de um
          músculo — o centro do peito, que é onde o dedo pousa, acertava o tronco. */}
      {NEUTRAL_SHAPES[view].map((d, i) => (
        <path key={i} d={d} fill="rgb(var(--surface-2))" stroke="rgb(var(--border))" strokeWidth={1.5} pointerEvents="none" />
      ))}

      {BODY[view].map(({ muscle, paths, hit }) => {
        const dado = porMusculo.get(muscle);
        const nivel = dado ? nivelDe(dado, mode) : "NENHUM";
        const cor = CORES[nivel];
        const ativo = selected === muscle;

        return (
          <g
            key={muscle}
            onClick={() => onSelect(muscle)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(muscle);
              }
            }}
            // O nome e o número no `aria-label`: sem isso o boneco é um desenho mudo, e a
            // informação que ele carrega só existiria pra quem enxerga a cor.
            aria-label={`${MUSCLE_LABEL[muscle]}: ${dado ? `${dado.sets} séries` : "sem treino"}`}
            className="cursor-pointer outline-none"
          >
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={cor.fill}
                stroke={ativo ? "rgb(var(--text))" : cor.stroke}
                strokeWidth={ativo ? 2.5 : 1.5}
                pointerEvents="none"
                className="transition-[fill,stroke,stroke-width] duration-200"
              />
            ))}
            {/* A área de toque por cima, invisível: o alvo é a região, não o desenho. */}
            {hit.map((d, i) => (
              <path key={`h${i}`} d={d} fill="transparent" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** A legenda. Fica junto do boneco porque a escala muda com o modo, e uma cor sem escala é só uma
 *  cor — "vermelho" quer dizer coisas opostas nos dois modos. */
export function BodyLegend({ mode }: { mode: MapMode }) {
  const faixas =
    mode === "CARGA"
      ? [
          ["NENHUM", "Não treinou"],
          ["POUCO", "Pouco"],
          ["MEDIO", "Médio"],
          ["MUITO", "Muito"],
        ]
      : [
          ["POUCO", "Em dia"],
          ["MEDIO", "7+ dias"],
          ["MUITO", "14+ dias ou nunca"],
        ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
      {faixas.map(([nivel, label]) => (
        <span key={nivel} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className={cn("h-3 w-3 shrink-0 rounded", nivel === "NENHUM" && "border border-[rgb(var(--border))]")}
            style={{ backgroundColor: CORES[nivel].fill }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
