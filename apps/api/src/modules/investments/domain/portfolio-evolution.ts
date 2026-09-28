/**
 * Reconstrói a evolução de uma classe inteira da carteira (Ações, FIIs, Cripto ou Renda Fixa) ao
 * longo do tempo, a partir do que já existe no banco: o extrato de transações e a série de fechamentos.
 *
 * O app nunca guardou um retrato diário do patrimônio — a alternativa seria começar a gravar um
 * agora e o gráfico só teria valor daqui a um ano. Como as duas peças necessárias já estão
 * guardadas (o que foi comprado/vendido e quanto o papel fechou em cada dia), dá pra remontar o
 * passado inteiro: **posição no dia D × fechamento no dia D**, somado pelos ativos da classe.
 *
 * Tudo aqui é função pura, sem I/O e sem Date.now(): quem chama passa as séries já carregadas e a
 * data de referência. É o que torna as regras abaixo testáveis dia a dia sem subir banco nem rede.
 */

import { FixedIncomeIndexer, FixedIncomeType } from "@prisma/client";
import { calculateFixedIncome } from "./fixed-income-calculator";

export type EvolutionRange = "1M" | "3M" | "6M" | "12M" | "CUSTOM";

export const EVOLUTION_RANGES: EvolutionRange[] = ["1M", "3M", "6M", "12M", "CUSTOM"];

export interface IsoWindow {
  /** YYYY-MM-DD, inclusivo. */
  from: string;
  /** YYYY-MM-DD, inclusivo. */
  to: string;
}

const MS_PER_DAY = 86_400_000;

export function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  return isoOf(new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY));
}

function daysBetweenIso(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

const RANGE_MONTHS: Record<Exclude<EvolutionRange, "CUSTOM">, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "12M": 12,
};

/**
 * Janela do gráfico. Os períodos fixos andam por **mês de calendário** (1M = "mesmo dia do mês
 * passado"), não por múltiplos de 30 dias — é como a pessoa lê "1 mês", e evita que 12M caia 5
 * dias antes do aniversário da aplicação.
 *
 * CUSTOM sem as duas pontas não vira erro: cai em 12M, porque um gráfico vazio por causa de um
 * parâmetro faltando é pior do que um gráfico com o período padrão.
 */
export function resolveEvolutionWindow(
  range: EvolutionRange,
  from: string | undefined,
  to: string | undefined,
  today: Date,
): IsoWindow {
  const hoje = isoOf(today);

  if (range === "CUSTOM") {
    if (!from || !to) return resolveEvolutionWindow("12M", undefined, undefined, today);
    // Invertido é erro de digitação, não motivo pra devolver nada: normaliza a ordem.
    return from <= to ? { from, to } : { from: to, to: from };
  }

  const ref = new Date(Date.parse(`${hoje}T00:00:00Z`));
  const inicio = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - RANGE_MONTHS[range], ref.getUTCDate()),
  );
  return { from: isoOf(inicio), to: hoje };
}

/**
 * As datas que viram pontos do gráfico.
 *
 * Um ano em dias corridos são 366 pontos: pesa pra renderizar, deixa o tooltip impossível de
 * acertar no celular e não mostra nada que a amostragem semanal já não mostre. O passo cresce com
 * a janela pra manter o total em torno de `maxPoints`, e a última data **sempre** entra — sem isso
 * o gráfico terminaria num ponto de dias atrás e pareceria desatualizado.
 */
export function buildDateGrid(window: IsoWindow, maxPoints = 120): string[] {
  const total = daysBetweenIso(window.from, window.to);
  if (total <= 0) return [window.to];

  const step = Math.max(1, Math.ceil(total / Math.max(1, maxPoints - 1)));
  const grid: string[] = [];
  for (let d = 0; d <= total; d += step) grid.push(addDaysIso(window.from, d));
  if (grid[grid.length - 1] !== window.to) grid.push(window.to);
  return grid;
}

export interface DatedClose {
  /** YYYY-MM-DD */
  date: string;
  close: number;
}

/**
 * Último fechamento em D ou antes.
 *
 * Carregar pra frente é obrigatório, não conveniência: o grid tem dias corridos e a bolsa não abre
 * no fim de semana. Sem isso, todo sábado o patrimônio despencaria pra zero e voltaria na segunda.
 * Devolve `null` quando não existe fechamento nenhum até D — quem chama decide o que fazer, porque
 * tratar ausência como zero é exatamente o erro que essa função existe pra evitar.
 */
export function closeAtOrBefore(series: DatedClose[], date: string): number | null {
  let melhor: number | null = null;
  for (const p of series) {
    if (p.date > date) break;
    melhor = p.close;
  }
  return melhor;
}

export interface EvolutionTransaction {
  assetId: string;
  type: "BUY" | "SELL";
  quantity: number;
  unitPrice: number;
  fees: number;
  /** YYYY-MM-DD */
  date: string;
}

export interface ValuePoint {
  date: string;
  /** Quanto a classe valia nesse dia, a preço de mercado. */
  value: number;
  /** Custo do que estava em carteira (preço médio × quantidade). */
  invested: number;
  /** Dinheiro que entrou (+) ou saiu (−) da classe desde o ponto anterior. */
  flow: number;
}

export interface AssetEvolutionResult {
  points: ValuePoint[];
  /** Tickers que ficaram de fora por não ter série de preço nenhuma. */
  withoutHistory: string[];
}

interface PositionState {
  quantity: number;
  averagePrice: number;
}

/**
 * Valor e custo da classe em cada data do grid.
 *
 * A varredura é uma passada só pelas transações ordenadas: pra cada data do grid, consome tudo que
 * aconteceu até ali e só então avalia a posição. Recalcular a posição do zero em cada ponto seria
 * O(datas × transações) — com 12 meses de grid e uma carteira de anos isso é a diferença entre uma
 * consulta e um travamento numa VPS de 1GB.
 *
 * Preço médio segue a mesma regra do resto do módulo (`calculatePosition`): compra dilui, venda
 * realiza contra a média sem mexer nela, e zerar a posição reseta a média.
 *
 * Três decisões que mudam o que o gráfico diz:
 * 1. **Sem fechamento até D, mas com posição aberta** → avalia pelo preço médio. O ativo entra pelo
 *    custo (lucro zero) em vez de sumir ou valer zero; é o que acontece no dia da compra mesmo.
 * 2. **Sem série nenhuma** → o ativo fica de fora do valor E do custo, e o ticker volta em
 *    `withoutHistory` pra tela avisar. Meio ativo dentro da soma seria um número que parece
 *    completo e não é.
 * 3. **Taxas entram no custo, não no fluxo de saída**: quem comprou R$ 1.000 + R$ 5 de corretagem
 *    desembolsou R$ 1.005, e é isso que o índice de retorno tem que descontar.
 */
export function buildAssetEvolution(
  grid: string[],
  transactions: EvolutionTransaction[],
  priceSeries: Map<string, DatedClose[]>,
  tickerOf: Map<string, string>,
): AssetEvolutionResult {
  const semSerie = new Set<string>();
  for (const tx of transactions) {
    const serie = priceSeries.get(tx.assetId);
    if (!serie || serie.length === 0) semSerie.add(tx.assetId);
  }

  // Ativo sem série sai da conta **inteiro**, transações incluídas. Deixar o dinheiro dele no
  // fluxo e o valor de fora era um bug de verdade: o índice de retorno via R$ 3.255 entrarem e
  // nada aparecer, e cravava −100% numa carteira que só estava sem cotação. Fora da soma
  // significa fora dos dois lados.
  const ordenadas = transactions
    .filter((t) => !semSerie.has(t.assetId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const posicoes = new Map<string, PositionState>();
  const semHistorico = new Set<string>();
  for (const assetId of semSerie) semHistorico.add(tickerOf.get(assetId) ?? assetId);

  let cursor = 0;
  let fluxoAcumulado = 0;
  const points: ValuePoint[] = [];

  for (const data of grid) {
    while (cursor < ordenadas.length && ordenadas[cursor].date <= data) {
      const tx = ordenadas[cursor++];
      const atual = posicoes.get(tx.assetId) ?? { quantity: 0, averagePrice: 0 };

      if (tx.type === "BUY") {
        const custoTotal = atual.quantity * atual.averagePrice + tx.quantity * tx.unitPrice + tx.fees;
        atual.quantity += tx.quantity;
        atual.averagePrice = atual.quantity > 0 ? custoTotal / atual.quantity : 0;
        fluxoAcumulado += tx.quantity * tx.unitPrice + tx.fees;
      } else {
        const vendida = Math.min(tx.quantity, atual.quantity);
        atual.quantity = Math.max(0, atual.quantity - tx.quantity);
        if (atual.quantity === 0) atual.averagePrice = 0;
        fluxoAcumulado -= vendida * tx.unitPrice - tx.fees;
      }

      posicoes.set(tx.assetId, atual);
    }

    let valor = 0;
    let custo = 0;
    for (const [assetId, pos] of posicoes) {
      if (pos.quantity <= 0) continue;
      const serie = priceSeries.get(assetId);
      if (!serie || serie.length === 0) continue;
      const fechamento = closeAtOrBefore(serie, data) ?? pos.averagePrice;
      valor += pos.quantity * fechamento;
      custo += pos.quantity * pos.averagePrice;
    }

    points.push({ date: data, value: valor, invested: custo, flow: fluxoAcumulado });
    fluxoAcumulado = 0;
  }

  return { points, withoutHistory: [...semHistorico].sort() };
}

/**
 * Índice de retorno base 100 — é ele, e não o valor em reais, que pode ser comparado com o CDI.
 *
 * Comparar o patrimônio cru com um índice é o erro clássico: um aporte de R$ 5.000 faz a linha da
 * carteira saltar e parecer que ela "bateu o CDI" num dia em que nada rendeu. Aqui cada intervalo
 * mede só o que o mercado fez: `valor_final / (valor_inicial + aporte do período)`, encadeado
 * ponto a ponto (retorno time-weighted, o mesmo critério que fundo usa pra divulgar rentabilidade).
 *
 * O aporte é tratado como se tivesse entrado no começo do intervalo. Numa amostragem semanal isso
 * desloca o retorno de um intervalo em fração de ponto percentual, e é a simplificação padrão
 * (Dietz) — a alternativa exigiria saber a hora de cada ordem, que o app não guarda.
 *
 * Intervalo que começa sem base (carteira zerada) não gera retorno: repete o índice anterior. Sem
 * essa guarda, o primeiro aporte da vida viraria uma divisão por zero e um salto infinito.
 */
export function buildReturnIndex(points: ValuePoint[]): number[] {
  if (points.length === 0) return [];
  const indice: number[] = [100];

  for (let i = 1; i < points.length; i++) {
    const base = points[i - 1].value + points[i].flow;
    if (base <= 0) {
      indice.push(indice[i - 1]);
      continue;
    }
    const retorno = points[i].value / base - 1;
    indice.push(indice[i - 1] * (1 + retorno));
  }

  return indice;
}

/** Variação total da série base 100, em %. `null` quando não há dois pontos pra comparar. */
export function totalReturnPercent(indice: (number | null)[]): number | null {
  const validos = indice.filter((v): v is number => v !== null);
  if (validos.length < 2) return null;
  const primeiro = validos[0];
  if (primeiro <= 0) return null;
  return (validos[validos.length - 1] / primeiro - 1) * 100;
}

export interface DailyRate {
  /** YYYY-MM-DD */
  date: string;
  /** Taxa em % ao dia. */
  value: number;
}

/**
 * CDI como índice base 100 no mesmo grid do gráfico.
 *
 * Acumula a série diária oficial (SGS 12) dia útil por dia útil — a mesma fonte e o mesmo
 * `∏(1 + taxa/100)` que a Renda Fixa usa pra bater cent a cent com o extrato. Extrapolar a taxa
 * anual de hoje pro passado inteiro daria uma reta bonita e errada em qualquer período que tenha
 * atravessado uma mudança de Selic.
 */
export function buildCdiIndex(rates: DailyRate[], grid: string[]): number[] {
  const ordenadas = [...rates].sort((a, b) => (a.date < b.date ? -1 : 1));
  const indice: number[] = [];
  let fator = 1;
  let cursor = 0;

  for (let i = 0; i < grid.length; i++) {
    // O primeiro ponto é a base: só acumula o que rendeu depois dele.
    while (cursor < ordenadas.length && ordenadas[cursor].date <= grid[i]) {
      const taxa = ordenadas[cursor++];
      if (taxa.date > grid[0]) fator *= 1 + taxa.value / 100;
    }
    indice.push(100 * fator);
  }

  return indice;
}

/**
 * Série de fechamentos (IBOV, IFIX) reprojetada no grid, base 100 no primeiro ponto.
 *
 * `null` nas datas anteriores ao primeiro fechamento disponível: a linha começa onde o dado
 * começa, em vez de desenhar uma reta em 100 que dá a impressão de um índice parado.
 */
export function buildPriceIndex(series: DatedClose[], grid: string[]): (number | null)[] {
  if (series.length === 0) return grid.map(() => null);
  const base = closeAtOrBefore(series, grid[0]) ?? series[0].close;
  if (!base || base <= 0) return grid.map(() => null);

  return grid.map((data) => {
    const fechamento = closeAtOrBefore(series, data);
    if (fechamento === null) return null;
    return (fechamento / base) * 100;
  });
}

export interface FixedIncomeSnapshot {
  id: string;
  principalAmount: number;
  /** YYYY-MM-DD */
  applicationDate: string;
  /** YYYY-MM-DD, ou null se ainda está aplicada. */
  redeemedAt: string | null;
  redeemedNetAmount: number | null;
  type: FixedIncomeType;
  indexer: FixedIncomeIndexer;
  fixedRatePercent: number | null;
  cdiPercent: number | null;
  /**
   * Valor líquido de hoje **já calculado pela tela de Renda Fixa**, com a regra de liquidação e os
   * dias ainda não publicados que fazem o número bater com o extrato do banco.
   *
   * O último ponto do gráfico usa esse valor em vez de recalcular: as duas contas diferem por um
   * dia útil de rendimento (uns R$ 5 numa posição de R$ 8.000 a 130% do CDI), e um gráfico que
   * termina num número diferente do card logo abaixo dele parece bug mesmo estando "quase certo".
   */
  currentNetValue: number;
}

/**
 * Evolução da Renda Fixa — o único caso em que o passado é **calculável**, não consultado.
 *
 * Ações e cripto dependem de um fechamento que alguém precisa ter publicado; uma aplicação de
 * renda fixa vale, em qualquer data, o que a fórmula diz que ela vale naquela data. A série diária
 * do CDI já está guardada em `economic_daily_rates` (histórico imutável), então dá pra remontar
 * a curva inteira sem uma requisição de rede.
 *
 * A varredura anda por aplicação, não por data: o fator do CDI é acumulativo e o percentual do
 * papel entra antes da capitalização, então recomeçar a acumulação em cada ponto do grid
 * multiplicaria o custo pelo número de pontos sem mudar o resultado.
 *
 * Limite conhecido e assumido: o `principalAmount` de hoje é usado como base no período inteiro.
 * Depois de um resgate parcial ele encolhe, e o app não guarda a série de principais — então uma
 * posição que já sofreu resgate parcial aparece no passado com a base de hoje. A linha do
 * resgatado entra pelo que de fato saiu (`redeemedNetAmount`), então o **retorno** continua certo;
 * o que fica menor é o patrimônio exibido nas datas anteriores ao resgate.
 */
export function buildFixedIncomeEvolution(
  grid: string[],
  applications: FixedIncomeSnapshot[],
  cdiRates: DailyRate[],
  indicators: { cdiAnnualRate: number; ipcaAnnualRate: number },
  todayIso: string,
): ValuePoint[] {
  const valores = grid.map(() => 0);
  const custos = grid.map(() => 0);
  const fluxos = grid.map(() => 0);
  const taxas = [...cdiRates].sort((a, b) => (a.date < b.date ? -1 : 1));

  for (const app of applications) {
    const share = Number(app.cdiPercent ?? 100) / 100;
    let fator = 1;
    let cursor = 0;
    let entrou = false;
    let saiu = false;

    for (let i = 0; i < grid.length; i++) {
      const data = grid[i];

      // Rendimento é creditado de um dia pro outro: a taxa do próprio dia da avaliação ainda não
      // caiu, então a janela é [aplicação, data) — a mesma de getDailyCdiWindow.
      while (cursor < taxas.length && taxas[cursor].date < data) {
        const taxa = taxas[cursor++];
        if (taxa.date >= app.applicationDate) fator *= 1 + (taxa.value / 100) * share;
      }

      if (data < app.applicationDate) continue;

      if (!entrou) {
        fluxos[i] += app.principalAmount;
        entrou = true;
      }

      if (app.redeemedAt && data >= app.redeemedAt) {
        if (!saiu) {
          fluxos[i] -= app.redeemedNetAmount ?? 0;
          saiu = true;
        }
        continue;
      }

      custos[i] += app.principalAmount;
      valores[i] +=
        data >= todayIso
          ? app.currentNetValue
          : calculateFixedIncome({
              principalAmount: app.principalAmount,
              applicationDate: new Date(`${app.applicationDate}T00:00:00Z`),
              asOfDate: new Date(`${data}T00:00:00Z`),
              type: app.type,
              indexer: app.indexer,
              fixedRatePercent: app.fixedRatePercent,
              cdiPercent: app.cdiPercent,
              cdiAnnualRate: indicators.cdiAnnualRate,
              cdiAccrualFactor: app.indexer === "POS_FIXADO_CDI" && taxas.length > 0 ? fator : null,
              ipcaAnnualRate: indicators.ipcaAnnualRate,
            }).netValue;
    }
  }

  return grid.map((date, i) => ({ date, value: valores[i], invested: custos[i], flow: fluxos[i] }));
}
