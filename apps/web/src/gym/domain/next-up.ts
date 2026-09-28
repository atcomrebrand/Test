/**
 * O que vem DEPOIS do descanso.
 *
 * O cronômetro é a única tela do treino em que a pessoa está parada esperando, e é exatamente aí
 * que ela quer saber o que vem — principalmente na virada de exercício, quando a resposta muda de
 * "mais uma igual" pra "levanta e vai pra outra máquina". Sem isso, o descanso acaba e ela precisa
 * fechar o painel pra descobrir o que fazer.
 */
export interface NextUpExercise {
  name: string;
  sets: { setNumber: number; completed: boolean }[];
}

export type NextUp =
  /** Mais uma série do mesmo exercício. */
  | { kind: "SET"; exerciseName: string; setNumber: number; totalSets: number }
  /** Acabou o exercício: o próximo é outro. */
  | { kind: "EXERCISE"; exerciseName: string; setNumber: number; totalSets: number }
  /** Não sobrou nada pendente. */
  | { kind: "END" };

export function nextUp(exercises: NextUpExercise[], fromExerciseIndex: number): NextUp {
  const atual = exercises[fromExerciseIndex];

  // Ainda tem série pendente no exercício de agora: é ela.
  const pendenteAqui = atual?.sets.find((s) => !s.completed);
  if (pendenteAqui) {
    return { kind: "SET", exerciseName: atual.name, setNumber: pendenteAqui.setNumber, totalSets: atual.sets.length };
  }

  // Olha PRA FRENTE primeiro: é a ordem em que a ficha foi montada, e é o que a pessoa espera.
  for (let i = fromExerciseIndex + 1; i < exercises.length; i++) {
    const pendente = exercises[i].sets.find((s) => !s.completed);
    if (pendente) {
      return { kind: "EXERCISE", exerciseName: exercises[i].name, setNumber: pendente.setNumber, totalSets: exercises[i].sets.length };
    }
  }

  // Só então volta pros que ficaram pra trás — quem pulou um exercício no começo não pode receber
  // "acabou" com série pendente na lista.
  for (let i = 0; i < fromExerciseIndex; i++) {
    const pendente = exercises[i].sets.find((s) => !s.completed);
    if (pendente) {
      return { kind: "EXERCISE", exerciseName: exercises[i].name, setNumber: pendente.setNumber, totalSets: exercises[i].sets.length };
    }
  }

  return { kind: "END" };
}
