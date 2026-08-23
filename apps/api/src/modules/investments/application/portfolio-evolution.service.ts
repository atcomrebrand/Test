import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { todayInBrazil } from "../domain/fixed-income-calculator";
import {
  buildAssetEvolution,
  buildCdiIndex,
  buildDateGrid,
  buildFixedIncomeEvolution,
  buildPriceIndex,
  buildReturnIndex,
  DatedClose,
  EvolutionRange,
  EvolutionTransaction,
  FixedIncomeSnapshot,
  isoOf,
  resolveEvolutionWindow,
  totalReturnPercent,
  ValuePoint,
} from "../domain/portfolio-evolution";
import { AssetHistoryService } from "../infrastructure/asset-history.service";
import { BenchmarkHistoryService, BenchmarkKey } from "../infrastructure/benchmark-history.service";
import { EconomicIndicatorCacheService } from "../infrastructure/economic-indicator-cache.service";
import { FixedIncomesService } from "./fixed-incomes.service";

export type EvolutionSeriesKey = "STOCK" | "FII" | "CRYPTO" | "RENDA_FIXA" | "TOTAL";

export interface EvolutionSeriesPoint {
  date: string;
  value: number;
  invested: number;
  profit: number;
  /** Retorno acumulado base 100 — é essa a linha que pode ser comparada com CDI/IBOV/IFIX. */
  index: number;
}

export interface EvolutionSeries {
  key: EvolutionSeriesKey;
  label: string;
  points: EvolutionSeriesPoint[];
  /** Ponta da série, pra não obrigar a tela a reler o último ponto. */
  value: number;
  invested: number;
  profit: number;
  returnPercent: number | null;
  /** Tickers que ficaram de fora por não ter histórico de preço nenhum. */
  withoutHistory: string[];
  hasData: boolean;
}

export interface EvolutionBenchmark {
  key: "CDI" | "IBOV" | "IFIX";
  label: string;
  points: { date: string; index: number | null }[];
  returnPercent: number | null;
  available: boolean;
}

export interface EvolutionResult {
  range: EvolutionRange;
  from: string;
  to: string;
  series: EvolutionSeries[];
  benchmarks: EvolutionBenchmark[];
}

const CLASS_LABEL: Record<EvolutionSeriesKey, string> = {
  STOCK: "Ações",
  FII: "FIIs",
  CRYPTO: "Criptomoedas",
  RENDA_FIXA: "Renda Fixa",
  TOTAL: "Carteira",
};

/** As três abas de ativo da Carteira. `FUND` existe no enum do Prisma mas não tem tela
 *  própria, então não vira linha do gráfico. */
const ASSET_CLASSES = ["STOCK", "FII", "CRYPTO"] as const;

/** A série pronta pra API mais os fluxos que a montaram — o total precisa somar os aportes das
 *  partes, e eles não sobrevivem no formato de resposta (que só fala de valor, custo e índice). */
interface SeriesWithFlows {
  series: EvolutionSeries;
  flows: number[];
}

/** Mesmo lote da cotação: a VPS tem 1GB e cada série é uma requisição HTTP com timeout próprio. */
const HISTORY_BATCH = 4;

/** A janela inteira é recalculada de uma vez; abrir a Carteira e trocar de aba não pode refazer
 *  tudo. Curto o suficiente pra "atualizar preços" aparecer no gráfico logo depois. */
const RESULT_TTL_MS = 10 * 60 * 1000;

/**
 * Evolução da carteira por classe, com CDI, Ibovespa e IFIX na mesma escala.
 *
 * O serviço monta **todas** as classes numa resposta só, e não só a aba aberta, por dois motivos:
 * comparar as abas entre si era metade do pedido, e o custo real (as séries de preço) é o mesmo —
 * o que pesa é ir na rede buscar histórico, não somar números.
 */
@Injectable()
export class PortfolioEvolutionService {
  private readonly logger = new Logger(PortfolioEvolutionService.name);
  private readonly cache = new Map<string, { result: EvolutionResult; at: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly assetHistory: AssetHistoryService,
    private readonly benchmarks: BenchmarkHistoryService,
    private readonly indicators: EconomicIndicatorCacheService,
    private readonly fixedIncomes: FixedIncomesService,
  ) {}

  async evolution(
    userId: string,
    range: EvolutionRange,
    from?: string,
    to?: string,
  ): Promise<EvolutionResult> {
    const hoje = todayInBrazil(new Date());
    const window = resolveEvolutionWindow(range, from, to, hoje);
    const grid = buildDateGrid(window);

    const chave = `${userId}:${window.from}:${window.to}`;
    const guardado = this.cache.get(chave);
    if (guardado && Date.now() - guardado.at < RESULT_TTL_MS) return { ...guardado.result, range };

    const [porClasse, rendaFixa, benchmarks] = await Promise.all([
      this.assetSeries(userId, grid, window.to),
      this.fixedIncomeSeries(userId, grid, window, isoOf(hoje)),
      this.benchmarkSeries(grid, window),
    ]);

    const partes = [...porClasse, rendaFixa];
    const result: EvolutionResult = {
      range,
      from: window.from,
      to: window.to,
      series: [...partes.map((p) => p.series), this.totalSeries(partes, grid).series],
      benchmarks,
    };

    this.cache.set(chave, { result, at: Date.now() });
    return result;
  }

  /** Ações, FIIs e cripto: posição reconstruída do extrato × fechamento do dia. */
  private async assetSeries(userId: string, grid: string[], to: string): Promise<SeriesWithFlows[]> {
    const assets = await this.prisma.investmentAsset.findMany({
      where: { userId, deletedAt: null },
      include: { transactions: { orderBy: { transactionDate: "asc" } } },
    });

    // Ativo zerado antes da janela não desenha nada: buscar a série dele seria uma requisição de
    // rede pra somar zero em cada ponto.
    const relevantes = assets.filter((a) => {
      const transacoes = a.transactions.filter((t) => isoOf(t.transactionDate) <= to);
      if (transacoes.length === 0) return false;
      const saldo = transacoes.reduce(
        (acc, t) => acc + (t.type === "BUY" ? Number(t.quantity) : -Number(t.quantity)),
        0,
      );
      return saldo > 0 || transacoes.some((t) => isoOf(t.transactionDate) >= grid[0]);
    });

    const seriesPorAtivo = await this.loadHistories(relevantes, grid[0], to);

    return ASSET_CLASSES.map((assetClass) => {
      const doGrupo = relevantes.filter((a) => a.class === assetClass);
      const transacoes: EvolutionTransaction[] = doGrupo.flatMap((a) =>
        a.transactions
          .filter((t) => isoOf(t.transactionDate) <= to)
          .map((t) => ({
            assetId: a.id,
            type: t.type === "BUY" ? ("BUY" as const) : ("SELL" as const),
            quantity: Number(t.quantity),
            unitPrice: Number(t.unitPrice),
            fees: Number(t.fees),
            date: isoOf(t.transactionDate),
          })),
      );

      const precos = new Map(doGrupo.map((a) => [a.id, seriesPorAtivo.get(a.id) ?? []]));
      const tickers = new Map(doGrupo.map((a) => [a.id, a.ticker]));
      const { points, withoutHistory } = buildAssetEvolution(grid, transacoes, precos, tickers);

      return this.toSeries(assetClass, points, withoutHistory);
    });
  }

  private async loadHistories(
    assets: { id: string; class: InvestmentAssetClass; ticker: string }[],
    from: string,
    to: string,
  ): Promise<Map<string, DatedClose[]>> {
    const resultado = new Map<string, DatedClose[]>();

    for (let i = 0; i < assets.length; i += HISTORY_BATCH) {
      const lote = assets.slice(i, i + HISTORY_BATCH);
      const series = await Promise.all(
        lote.map(async (a) => {
          try {
            return await this.assetHistory.getSeries(a, from, to);
          } catch (err) {
            this.logger.warn(`Série de ${a.ticker} indisponível: ${(err as Error).message}`);
            return [];
          }
        }),
      );
      lote.forEach((a, idx) => resultado.set(a.id, series[idx]));
    }

    return resultado;
  }

  /**
   * Renda Fixa: o único caso calculável sem rede. Precisa da série do CDI desde a aplicação mais
   * antiga — não desde o começo da janela —, porque o fator de rendimento é acumulado desde o dia
   * da aplicação, e começar no meio daria um valor menor do que a aplicação realmente vale.
   */
  private async fixedIncomeSeries(
    userId: string,
    grid: string[],
    window: { from: string; to: string },
    hojeIso: string,
  ): Promise<SeriesWithFlows> {
    const aplicacoes = await this.fixedIncomes.findAll(userId);
    const ativas = aplicacoes.filter((f) => !f.deletedAt);

    if (ativas.length === 0) return this.toSeries("RENDA_FIXA", grid.map((date) => ({ date, value: 0, invested: 0, flow: 0 })), []);

    const maisAntiga = ativas.reduce(
      (min, f) => (f.applicationDate < min ? f.applicationDate : min),
      ativas[0].applicationDate,
    );
    const inicioSerie = new Date(Math.min(maisAntiga.getTime(), Date.parse(`${window.from}T00:00:00Z`)));

    let taxas: { date: string; value: number }[] = [];
    try {
      taxas = await this.indicators.getDailyCdiSeries(inicioSerie, new Date(`${window.to}T00:00:00Z`));
    } catch (err) {
      this.logger.warn(`Série do CDI indisponível pro gráfico: ${(err as Error).message}`);
    }

    const [cdiAnnualRate, ipcaAnnualRate] = await Promise.all([
      this.indicators.getAnnualCdiRate().catch(() => 0),
      this.indicators.getAnnualIpcaRate().catch(() => 0),
    ]);

    const snapshots: FixedIncomeSnapshot[] = ativas.map((f) => ({
      id: f.id,
      principalAmount: Number(f.principalAmount),
      applicationDate: isoOf(f.applicationDate),
      redeemedAt: f.redeemedAt ? isoOf(f.redeemedAt) : null,
      redeemedNetAmount: f.redeemedNetAmount === null ? null : Number(f.redeemedNetAmount),
      type: f.type,
      indexer: f.indexer,
      fixedRatePercent: f.fixedRatePercent === null ? null : Number(f.fixedRatePercent),
      cdiPercent: f.cdiPercent === null ? null : Number(f.cdiPercent),
      currentNetValue: f.calculation.netValue,
    }));

    const points = buildFixedIncomeEvolution(grid, snapshots, taxas, { cdiAnnualRate, ipcaAnnualRate }, hojeIso);
    return this.toSeries("RENDA_FIXA", points, []);
  }

  private async benchmarkSeries(grid: string[], window: { from: string; to: string }): Promise<EvolutionBenchmark[]> {
    const [cdi, ibov, ifix] = await Promise.all([
      this.indicators
        .getDailyCdiSeries(new Date(`${window.from}T00:00:00Z`), new Date(`${window.to}T00:00:00Z`))
        .catch(() => [] as { date: string; value: number }[]),
      this.benchmarks.getSeries("IBOV", window.from, window.to).catch(() => [] as DatedClose[]),
      this.benchmarks.getSeries("IFIX", window.from, window.to).catch(() => [] as DatedClose[]),
    ]);

    const cdiIndex = buildCdiIndex(cdi, grid);
    const linhas: EvolutionBenchmark[] = [
      {
        key: "CDI",
        label: "CDI",
        points: grid.map((date, i) => ({ date, index: cdiIndex[i] })),
        returnPercent: cdi.length > 0 ? totalReturnPercent(cdiIndex) : null,
        available: cdi.length > 0,
      },
    ];

    for (const [key, serie] of [
      ["IBOV", ibov],
      ["IFIX", ifix],
    ] as [BenchmarkKey, DatedClose[]][]) {
      const index = buildPriceIndex(serie, grid);
      linhas.push({
        key,
        label: BenchmarkHistoryService.label(key),
        points: grid.map((date, i) => ({ date, index: index[i] })),
        returnPercent: totalReturnPercent(index),
        available: serie.length > 0,
      });
    }

    return linhas;
  }

  /** A carteira inteira: soma dos valores, e o índice recalculado sobre a soma. Somar os índices
   *  das classes daria média de rentabilidades — o mesmo erro do churn de "Todos" no CRM. */
  private totalSeries(partes: SeriesWithFlows[], grid: string[]): SeriesWithFlows {
    const points: ValuePoint[] = grid.map((date, i) => ({
      date,
      value: partes.reduce((acc, p) => acc + (p.series.points[i]?.value ?? 0), 0),
      invested: partes.reduce((acc, p) => acc + (p.series.points[i]?.invested ?? 0), 0),
      flow: partes.reduce((acc, p) => acc + (p.flows[i] ?? 0), 0),
    }));

    const withoutHistory = [...new Set(partes.flatMap((p) => p.series.withoutHistory))].sort();
    return this.toSeries("TOTAL", points, withoutHistory);
  }

  private toSeries(key: EvolutionSeriesKey, points: ValuePoint[], withoutHistory: string[]): SeriesWithFlows {
    const indice = buildReturnIndex(points);
    const ultimo = points[points.length - 1];

    const series: EvolutionSeries = {
      key,
      label: CLASS_LABEL[key],
      points: points.map((p, i) => ({
        date: p.date,
        value: p.value,
        invested: p.invested,
        profit: p.value - p.invested,
        index: indice[i],
      })),
      value: ultimo?.value ?? 0,
      invested: ultimo?.invested ?? 0,
      profit: (ultimo?.value ?? 0) - (ultimo?.invested ?? 0),
      // Classe sem posição no período não rendeu 0% — ela não tem rentabilidade nenhuma pra
      // mostrar, e "0,00%" ao lado do CDI parece um desempenho medido.
      returnPercent: points.some((p) => p.value > 0) ? totalReturnPercent(indice) : null,
      withoutHistory,
      hasData: points.some((p) => p.value > 0),
    };

    return { series, flows: points.map((p) => p.flow) };
  }
}
