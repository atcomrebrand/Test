import { GymEquipment, GymMuscle, GymObjective, GymLevel, GymRecordKind } from "./types";

/**
 * Design system do módulo, num lugar só (§58).
 *
 * A cor de destaque é o **azul** — a mesma família que os botões de ação já usavam na execução, o
 * que deixa o módulo inteiro falando uma língua só.
 *
 * Duas notas de contraste, que é o que decide os tons aqui:
 *
 * - **Texto branco sobre `sky-500` só em peça grande e em negrito** (botão, chip em caixa alta).
 *   O par dá ~3:1, que passa pra "texto grande" e reprova pra texto normal — por isso o rótulo
 *   pequeno usa `solidSm`, um tom mais escuro, em vez de encolher o mesmo azul.
 * - **Texto em azul sobre superfície usa o par claro/escuro** (`sky-600` no claro, `sky-400` no
 *   escuro): o azul vibrante do §3 vale pro fundo do botão, não pra tipografia sobre fundo branco.
 */
export const GYM = {
  /** Fundo de botão e de ícone: a cor cheia. Sempre com texto branco e em peça grande. */
  solid: "bg-sky-500",
  solidHover: "hover:bg-sky-400",
  /** A mesma cor um tom abaixo, pro que é pequeno e precisa de 4,5:1 com branco. */
  solidSm: "bg-sky-600",
  /** Texto e ícone sobre superfície: o par que passa em contraste nos dois temas. */
  text: "text-sky-600 dark:text-sky-400",
  ring: "ring-sky-500",
  soft: "bg-sky-500/10",
  border: "border-sky-500/30",
  /** Cor crua, pros gráficos e pro que não é classe do Tailwind. */
  hex: "#0EA5E9",
  hexDim: "#0369A1",
} as const;

export const MUSCLE_LABEL: Record<GymMuscle, string> = {
  PEITO: "Peito",
  COSTAS: "Costas",
  BICEPS: "Bíceps",
  TRICEPS: "Tríceps",
  OMBROS: "Ombros",
  QUADRICEPS: "Quadríceps",
  POSTERIORES: "Posteriores",
  GLUTEOS: "Glúteos",
  PANTURRILHAS: "Panturrilhas",
  ABDOMEN: "Abdômen",
  TRAPEZIO: "Trapézio",
  ANTEBRACO: "Antebraço",
};

export const EQUIPMENT_LABEL: Record<GymEquipment, string> = {
  BARRA: "Barra",
  HALTER: "Halteres",
  MAQUINA: "Máquina",
  CABO: "Cabo",
  PESO_CORPORAL: "Peso corporal",
  SMITH: "Smith",
  KETTLEBELL: "Kettlebell",
  ELASTICO: "Elástico",
  OUTRO: "Outro",
};

export const OBJECTIVE_LABEL: Record<GymObjective, string> = {
  HIPERTROFIA: "Hipertrofia",
  FORCA: "Força",
  EMAGRECIMENTO: "Emagrecimento",
  CONDICIONAMENTO: "Condicionamento",
  MANUTENCAO: "Manutenção",
};

export const LEVEL_LABEL: Record<GymLevel, string> = {
  INICIANTE: "Iniciante",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
};

export const RECORD_LABEL: Record<GymRecordKind, string> = {
  PESO_MAXIMO: "Nova carga máxima",
  REPS_NO_PESO: "Mais repetições",
  VOLUME_EXERCICIO: "Maior volume",
  UM_RM: "Novo 1RM",
};

/** "01:04:32" pro cronômetro da sessão; "55 min" pros resumos. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

/**
 * Volume em quilos. Não passa pelo `formatCurrency` — não é dinheiro —, mas **respeita o modo
 * privacidade** pelo mesmo motivo dele existir: quanto alguém levanta é informação pessoal, e a
 * tela ficaria estranha com tudo mascarado menos os números grandes de volume.
 */
export function formatVolume(kg: number | null | undefined, hidden = false): string {
  if (hidden) return "•••••";
  if (kg === null || kg === undefined) return "—";
  // SEMPRE em quilos, nunca em toneladas. Volume de treino é lido em kg em qualquer academia, e
  // converter passava de "2.080 kg" pra "2,1 t" logo na terceira série — o número perde a precisão
  // justamente na faixa em que ele vive, e passa a parecer errado mesmo estando certo.
  return `${Math.round(kg).toLocaleString("pt-BR")} kg`;
}

export function formatWeight(kg: number, unit: "KG" | "LB" = "KG"): string {
  const v = unit === "LB" ? kg * 2.20462 : kg;
  const label = unit === "LB" ? "lb" : "kg";
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} ${label}`;
}
