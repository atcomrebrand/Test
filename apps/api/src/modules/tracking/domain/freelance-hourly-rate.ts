export interface FreelanceHourlyRateInput {
  /** Valor total combinado pelo projeto inteiro, já em BRL. */
  totalAgreedValueBRL: number;
  /** Soma de netSeconds de todas as sessões (concluídas + a atual, se houver) desse trabalho. */
  totalNetSeconds: number;
}

/**
 * Diferente de estimateJobHourlyRate (trabalho fixo, que estima a partir de salário+jornada antes
 * de existir histórico), um freela não tem jornada nem valor mensal — o valor/hora só existe
 * dividindo o valor combinado pelas horas realmente cronometradas até agora, e muda a cada nova
 * sessão. Sem nenhuma hora ainda cronometrada, não há valor/hora a mostrar (null, não zero/infinito).
 */
export function computeFreelanceHourlyRate(input: FreelanceHourlyRateInput): number | null {
  const { totalAgreedValueBRL, totalNetSeconds } = input;
  if (totalNetSeconds <= 0) return null;

  const totalHours = totalNetSeconds / 3600;
  return Math.round((totalAgreedValueBRL / totalHours) * 100) / 100;
}
