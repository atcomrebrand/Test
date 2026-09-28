import { GymEquipment, GymMuscle, GymObjective, GymLevel, GymRecordKind } from "./types";

/**
 * Design system do módulo, num lugar só (§58).
 *
 * A cor de destaque é o **verde lima** do módulo — nenhum outro do app usa, então a Academia se
 * distingue de relance na Home e nos ícones.
 *
 * Duas notas que decidem os tons aqui:
 *
 * - **Sobre o lima cheio o texto é ESCURO**, não branco: lima é uma cor clara, e branco sobre ela dá
 *   menos de 2:1. O par com `neutral-900` passa folgado.
 * - **Texto em verde sobre superfície usa o par claro/escuro** (`lime-600` no claro, `lime-400` no
 *   escuro): a cor vibrante vale pro fundo do botão, não pra tipografia sobre fundo branco.
 *
 * O **esmeralda é reservado pro que está CONCLUÍDO** (série marcada, exercício terminado, fim do
 * descanso) — ver a nota no CLAUDE.md. Sem essa separação, "vou fazer" e "já fiz" ficam da mesma cor
 * justamente na tela em que a diferença importa.
 */
export const GYM = {
  /** Fundo de botão e de ícone: a cor cheia. Sempre com texto escuro. */
  solid: "bg-lime-500",
  solidHover: "hover:bg-lime-400",
  /** Um tom abaixo, pro que é pequeno e precisa de mais contraste. */
  solidSm: "bg-lime-600",
  /** Texto e ícone sobre superfície: o par que passa em contraste nos dois temas. */
  text: "text-lime-600 dark:text-lime-400",
  ring: "ring-lime-500",
  soft: "bg-lime-500/10",
  border: "border-lime-500/30",
  /** Cor crua, pros gráficos e pro que não é classe do Tailwind. */
  hex: "#84CC16",
  hexDim: "#4D7C0F",
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
 * Volume em quilos.
 *
 * **Não passa pelo modo privacidade**, e o olho nem aparece no cabeçalho da Academia: o que aquele
 * modo esconde é dinheiro, e aqui não há nenhum. Mascarar volume só criaria uma armadilha —
 * privacidade ligada em outra tela deixaria o treino cheio de `•••••` sem nenhum botão à mão pra
 * desligar.
 */
export function formatVolume(kg: number | null | undefined): string {
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
