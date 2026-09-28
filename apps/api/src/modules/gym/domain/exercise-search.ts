/**
 * Busca da biblioteca de exercícios (§23).
 *
 * Acento fora da comparação de propósito: quem está de pé na academia digita "trice" e "biceps"
 * sem acento, e um filtro que exige "tríceps" exato não encontra nada — o pior resultado possível
 * numa busca instantânea.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface SearchableExercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
}

export interface SearchFilters {
  query?: string;
  muscle?: string | null;
  equipment?: string | null;
  favoriteIds?: Set<string>;
  onlyFavorites?: boolean;
}

/**
 * Todo termo digitado precisa aparecer em algum campo — e não a frase inteira num campo só.
 * "supino halter" tem que achar "Supino reto com halteres", que não contém a sequência literal.
 */
export function matchesExercise(exercise: SearchableExercise, filters: SearchFilters): boolean {
  if (filters.onlyFavorites && !filters.favoriteIds?.has(exercise.id)) return false;
  if (filters.muscle && exercise.primaryMuscle !== filters.muscle && !exercise.secondaryMuscles.includes(filters.muscle)) {
    return false;
  }
  if (filters.equipment && exercise.equipment !== filters.equipment) return false;

  const termos = normalize(filters.query ?? "").split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;

  const alvo = normalize([exercise.name, exercise.primaryMuscle, ...exercise.secondaryMuscles, exercise.equipment].join(" "));
  return termos.every((t) => alvo.includes(t));
}

/**
 * Ordena o resultado: quem começa com o termo primeiro, depois quem só contém.
 *
 * Sem isso, buscar "rosca" mostraria "Tríceps pulley pegada inversa" antes de "Rosca direta" em
 * qualquer ordem alfabética infeliz.
 */
export function rankExercises<T extends SearchableExercise>(exercises: T[], query: string, usage?: Map<string, number>): T[] {
  const q = normalize(query);
  return [...exercises].sort((a, b) => {
    if (q) {
      const pa = normalize(a.name).startsWith(q) ? 0 : 1;
      const pb = normalize(b.name).startsWith(q) ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    const ua = usage?.get(a.id) ?? 0;
    const ub = usage?.get(b.id) ?? 0;
    if (ua !== ub) return ub - ua;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
