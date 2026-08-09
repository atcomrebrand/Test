import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { EconomicIndicatorProvider } from "../domain/market-data.provider";

const TTL_MS = 6 * 60 * 60 * 1000;

/** Série SGS 12 — CDI em % ao dia. */
const CDI_DAILY_SERIES = 12;

/** A série sai uma vez por dia útil; não adianta pedir a ponta de novo a cada request. */
const TAIL_REFETCH_TTL_MS = 60 * 60 * 1000;

function atUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export interface DailyCdiWindow {
  /** Taxas em % ao dia, em ordem, só dos dias úteis do período. */
  rates: number[];
  /** Último dia útil que a série cobre — o quanto o número está atualizado. */
  lastDate: Date | null;
}

/** In-memory TTL cache in front of BacenProvider — CDI/IPCA move at most once a day, and losing
 *  the cache on a restart is harmless (it just refetches once), so no DB table is needed.
 *
 *  A série *diária* é outra história: é histórico imutável e pode somar anos de dias úteis, então
 *  ela vai pro banco (`economic_daily_rates`) e só a ponta nova vai à rede. */
@Injectable()
export class EconomicIndicatorCacheService {
  private readonly logger = new Logger(EconomicIndicatorCacheService.name);
  private cdi: { value: number; fetchedAt: number } | null = null;
  private ipca: { value: number; fetchedAt: number } | null = null;
  private lastTailFetchAt = 0;

  constructor(
    private readonly provider: EconomicIndicatorProvider,
    private readonly prisma: PrismaService,
  ) {}

  async getAnnualCdiRate(): Promise<number> {
    if (this.cdi && Date.now() - this.cdi.fetchedAt < TTL_MS) return this.cdi.value;
    const value = await this.provider.fetchAnnualCdiRate();
    this.cdi = { value, fetchedAt: Date.now() };
    return value;
  }

  async getAnnualIpcaRate(): Promise<number> {
    if (this.ipca && Date.now() - this.ipca.fetchedAt < TTL_MS) return this.ipca.value;
    const value = await this.provider.fetchAnnualIpcaRate();
    this.ipca = { value, fetchedAt: Date.now() };
    return value;
  }

  /**
   * Taxas diárias do CDI que valem pro período [from, to) — o dia do `to` não entra porque o
   * rendimento é creditado de um dia pro outro, então a aplicação só passa a render no dia
   * seguinte ao que foi feita.
   *
   * Devolve `null` quando não deu pra montar a série (fonte fora do ar e nada no banco); aí o
   * cálculo cai na taxa anual, que é aproximada.
   */
  async getDailyCdiWindow(from: Date, to: Date): Promise<DailyCdiWindow | null> {
    const inicio = atUtcMidnight(from);
    const fim = atUtcMidnight(to);
    if (inicio.getTime() >= fim.getTime()) return { rates: [], lastDate: null };

    // O último dia que pode render é a véspera do "as of".
    const ultimoDia = addDays(fim, -1);

    await this.ensureSeriesCovers(inicio, ultimoDia);

    const rows = await this.prisma.economicDailyRate.findMany({
      where: { series: CDI_DAILY_SERIES, date: { gte: inicio, lte: ultimoDia } },
      orderBy: { date: "asc" },
    });
    if (rows.length === 0) return null;

    return { rates: rows.map((r) => Number(r.value)), lastDate: rows[rows.length - 1].date };
  }

  /** Busca no Bacen só o pedaço do intervalo que ainda não está no banco. */
  private async ensureSeriesCovers(from: Date, to: Date): Promise<void> {
    const [primeira, ultima] = await Promise.all([
      this.prisma.economicDailyRate.findFirst({ where: { series: CDI_DAILY_SERIES }, orderBy: { date: "asc" } }),
      this.prisma.economicDailyRate.findFirst({ where: { series: CDI_DAILY_SERIES }, orderBy: { date: "desc" } }),
    ]);

    const buracos: { from: Date; to: Date }[] = [];
    if (!primeira || !ultima) {
      buracos.push({ from, to });
    } else {
      if (from.getTime() < primeira.date.getTime()) buracos.push({ from, to: addDays(primeira.date, -1) });
      // A ponta é a única parte que muda com o tempo, então tem TTL próprio — sem isso cada leitura
      // de tela bateria no Bacen procurando um dia que ainda nem foi publicado.
      if (to.getTime() > ultima.date.getTime() && Date.now() - this.lastTailFetchAt > TAIL_REFETCH_TTL_MS) {
        this.lastTailFetchAt = Date.now();
        buracos.push({ from: addDays(ultima.date, 1), to });
      }
    }

    for (const buraco of buracos) {
      const pontos = await this.provider.fetchDailyCdiSeries(buraco.from, buraco.to);
      if (!pontos || pontos.length === 0) continue;
      // createMany + skipDuplicates: duas requisições simultâneas podem trazer o mesmo dia, e o
      // unique (series, date) resolve sem transformar corrida em erro 500.
      await this.prisma.economicDailyRate.createMany({
        data: pontos.map((p) => ({ series: CDI_DAILY_SERIES, date: p.date, value: p.value })),
        skipDuplicates: true,
      });
      this.logger.log(`CDI diário: ${pontos.length} dia(s) guardado(s) de ${buraco.from.toISOString().slice(0, 10)}`);
    }
  }
}
