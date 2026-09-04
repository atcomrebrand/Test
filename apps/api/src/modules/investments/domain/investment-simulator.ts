import { FixedIncomeIndexer, FixedIncomeType } from "@prisma/client";
import { calculateFixedIncome } from "./fixed-income-calculator";

/**
 * Simuladores: renda fixa até o vencimento e projeção de aporte mensal.
 *
 * A diferença entre isto e o resto do módulo é o tempo: aqui se olha pra **frente**, onde não
 * existe série do CDI pra consultar. Então tudo aqui é projeção da taxa de hoje repetida pro
 * período inteiro — e é obrigação de quem mostra na tela dizer isso, porque o número sai com cara
 * de exato. A conta de imposto, essa, é a mesma que já bate cent a cent com o extrato do banco.
 */

const MESES_NO_ANO = 12;

// ---------------------------------------------------------------------------
// Renda fixa
// ---------------------------------------------------------------------------

export interface SimulationRates {
  /** CDI ao ano, % (SGS 4392). */
  cdiAnnual: number;
  /** IPCA acumulado 12 meses, %. */
  ipcaAnnual: number;
  /** Meta Selic ao ano, % (SGS 432) — só a poupança depende dela. */
  selicAnnual: number;
}

export interface FixedIncomeSimulationInput {
  amount: number;
  months: number;
  type: FixedIncomeType;
  indexer: FixedIncomeIndexer;
  /** POS_FIXADO_CDI: ex. 110 = 110% do CDI. */
  cdiPercent?: number | null;
  /** PREFIXADO: taxa a.a. IPCA_MAIS: spread a.a. sobre o IPCA. */
  fixedRatePercent?: number | null;
  rates: SimulationRates;
  /** Data de referência — injetada pra a função ser pura e testável. */
  today: Date;
}

export interface FixedIncomeSimulationResult {
  maturityDate: string;
  days: number;
  invested: number;
  grossValue: number;
  grossYield: number;
  irRate: number;
  irAmount: number;
  iofRate: number;
  iofAmount: number;
  netValue: number;
  netYield: number;
  /** Rendimento líquido sobre o aplicado, no período. */
  netPercent: number;
  /** O mesmo rendimento expresso ao ano — é o número que compara papéis de prazos diferentes. */
  netAnnualPercent: number;
}

function addMonths(date: Date, months: number): Date {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));
  // 31/01 + 1 mês não existe: o Date rola pra 03/03. Volta pro último dia do mês pretendido, que é
  // o que qualquer banco faz com vencimento.
  if (alvo.getUTCDate() !== base.getUTCDate()) alvo.setUTCDate(0);
  return alvo;
}

/**
 * Regra da poupança pós-maio/2012: **70% da Selic + TR** enquanto a Selic está em 8,5% a.a. ou
 * menos; acima disso, **0,5% ao mês + TR** (os famosos ~6,17% a.a.).
 *
 * A TR entra como zero. Ela ficou zerada por anos e voltou a ser positiva com a Selic alta, então o
 * número aqui é um **piso** da poupança, não uma previsão exata — e como a poupança serve de régua
 * ("meu CDB ganha dela?"), errar pro lado de favorecer a poupança é o lado seguro de errar.
 */
export function poupancaAnnualRate(selicAnnual: number): number {
  if (selicAnnual <= 8.5) return selicAnnual * 0.7;
  return (Math.pow(1.005, MESES_NO_ANO) - 1) * 100;
}

/**
 * Quanto um papel rende até o vencimento, com IR e IOF.
 *
 * Reaproveita `calculateFixedIncome` inteiro — a mesma função que a tela de Renda Fixa usa e que já
 * foi conferida contra o extrato do banco. Aqui ela é chamada com a data futura do vencimento e
 * **sem** fator acumulado do CDI (que não existe pro futuro), então ela cai na extrapolação da taxa
 * anual de hoje. É exatamente o que uma simulação é.
 */
export function simulateFixedIncome(input: FixedIncomeSimulationInput): FixedIncomeSimulationResult {
  const vencimento = addMonths(input.today, Math.max(1, Math.round(input.months)));

  const calc = calculateFixedIncome({
    principalAmount: input.amount,
    applicationDate: input.today,
    asOfDate: vencimento,
    type: input.type,
    indexer: input.indexer,
    fixedRatePercent: input.fixedRatePercent,
    cdiPercent: input.cdiPercent,
    cdiAnnualRate: input.rates.cdiAnnual,
    ipcaAnnualRate: input.rates.ipcaAnnual,
    cdiAccrualFactor: null,
  });

  // Ao ano, pra comparar prazos diferentes na mesma régua: um papel de 6 meses que rende 6% não é
  // melhor que um de 12 que rende 11%.
  const anos = calc.daysElapsed / 365;
  const netAnnualPercent =
    anos > 0 && input.amount > 0 ? (Math.pow(calc.netValue / input.amount, 1 / anos) - 1) * 100 : 0;

  return {
    maturityDate: vencimento.toISOString().slice(0, 10),
    days: calc.daysElapsed,
    invested: input.amount,
    grossValue: calc.grossValue,
    grossYield: calc.grossYield,
    irRate: calc.irRate,
    irAmount: calc.irAmount,
    iofRate: calc.iofRate,
    iofAmount: calc.iofAmount,
    netValue: calc.netValue,
    netYield: calc.netYield,
    netPercent: calc.netProfitabilityPercent,
    netAnnualPercent,
  };
}

// ---------------------------------------------------------------------------
// Aporte mensal
// ---------------------------------------------------------------------------

export interface ContributionSimulationInput {
  initialAmount: number;
  monthlyAmount: number;
  /** Taxa ao ano, %. */
  annualRatePercent: number;
  months: number;
}

export interface ContributionPoint {
  month: number;
  /** Dinheiro que saiu do bolso até aqui. */
  contributed: number;
  /** O que os juros somaram até aqui. */
  interest: number;
  total: number;
}

export interface ContributionSimulationResult {
  points: ContributionPoint[];
  contributed: number;
  interest: number;
  total: number;
  /** Quanto do resultado é juro, em % — é o número que mostra o tempo trabalhando. */
  interestShare: number;
}

/**
 * Taxa mensal equivalente a uma taxa anual.
 *
 * **Não é a anual dividida por 12.** Dividir ignora que o juro do mês rende no mês seguinte, e
 * subestima o resultado: 12% ao ano são 0,9489% ao mês, não 1%. A diferença parece pequena e vira
 * milhares de reais em dez anos, que é justamente o horizonte pra que essa simulação existe.
 */
export function monthlyRateFromAnnual(annualRatePercent: number): number {
  return Math.pow(1 + annualRatePercent / 100, 1 / MESES_NO_ANO) - 1;
}

/**
 * Projeção de aporte mensal.
 *
 * O aporte entra no **fim** de cada mês (convenção padrão): o dinheiro do mês 1 só rende a partir
 * do mês 2. Tratar como início inflaria o resultado num mês inteiro de juro que não aconteceu.
 */
export function simulateContributions(input: ContributionSimulationInput): ContributionSimulationResult {
  const taxa = monthlyRateFromAnnual(input.annualRatePercent);
  const meses = Math.max(0, Math.round(input.months));

  const points: ContributionPoint[] = [];
  let total = input.initialAmount;
  let aportado = input.initialAmount;

  points.push({ month: 0, contributed: aportado, interest: 0, total });

  for (let mes = 1; mes <= meses; mes++) {
    total = total * (1 + taxa) + input.monthlyAmount;
    aportado += input.monthlyAmount;
    points.push({
      month: mes,
      contributed: aportado,
      // Arredondado só na saída: acumular já arredondado faria o erro crescer mês a mês.
      interest: total - aportado,
      total,
    });
  }

  const juros = total - aportado;
  return {
    points,
    contributed: aportado,
    interest: juros,
    total,
    interestShare: total > 0 ? (juros / total) * 100 : 0,
  };
}

/**
 * Em quantos meses a projeção alcança um alvo. `null` quando não alcança nunca — sem aporte e sem
 * juro, a conta não anda, e devolver um número grande fingiria uma resposta.
 */
export function monthsToReach(target: number, input: Omit<ContributionSimulationInput, "months">, limiteMeses = 1200): number | null {
  if (target <= input.initialAmount) return 0;

  const taxa = monthlyRateFromAnnual(input.annualRatePercent);
  let total = input.initialAmount;

  for (let mes = 1; mes <= limiteMeses; mes++) {
    total = total * (1 + taxa) + input.monthlyAmount;
    if (total >= target) return mes;
  }
  return null;
}
