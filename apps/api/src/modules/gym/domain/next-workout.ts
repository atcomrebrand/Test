/**
 * Qual é o "treino de hoje".
 *
 * A regra é **rodízio pela ordem da lista**: fez o A, o próximo é o B. É assim que um ABCD funciona
 * na cabeça de quem treina, e é previsível — a pessoa sabe o que vai aparecer amanhã sem precisar
 * conferir data nenhuma.
 *
 * A regra anterior era "o que está há mais tempo parado". Ela acerta enquanto o rodízio é perfeito,
 * mas erra exatamente quando ele não é: repetir um treino, pular uma ficha ou treinar duas vezes no
 * mesmo dia embaralha as datas e o app passa a sugerir uma ficha que não é a seguinte. Ela continua
 * existindo aqui, só que como plano B.
 */
export interface WorkoutOption {
  id: string;
  order: number;
  lastPerformedAt?: string | Date | null;
}

export function pickNextWorkout<T extends WorkoutOption>(workouts: T[], lastPerformedWorkoutId?: string | null): T | null {
  if (workouts.length === 0) return null;
  const ordenados = [...workouts].sort((a, b) => a.order - b.order);

  // O rodízio só existe se a última sessão veio de uma ficha que ainda está na lista. Ficha
  // arquivada depois de treinada não define "a próxima" — não há próxima a partir do que sumiu.
  if (lastPerformedWorkoutId) {
    const i = ordenados.findIndex((w) => w.id === lastPerformedWorkoutId);
    if (i !== -1) return ordenados[(i + 1) % ordenados.length];
  }

  // Plano B: quem nunca foi feito primeiro, na ordem da lista; depois o mais antigo. É o que
  // atende quem acabou de montar as fichas e ainda não treinou nenhuma.
  const nunca = ordenados.filter((w) => !w.lastPerformedAt);
  if (nunca.length > 0) return nunca[0];

  return [...ordenados].sort(
    (a, b) => new Date(a.lastPerformedAt!).getTime() - new Date(b.lastPerformedAt!).getTime(),
  )[0];
}
