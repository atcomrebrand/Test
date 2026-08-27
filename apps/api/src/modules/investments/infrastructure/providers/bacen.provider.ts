import { Injectable, Logger } from "@nestjs/common";
import { DailyRatePoint, EconomicIndicatorProvider } from "../../domain/market-data.provider";

/** SGS (Sistema Gerenciador de Séries Temporais) series codes from the Banco Central open API. */
const CDI_ANNUALIZED_SERIES = 4392;
const CDI_DAILY_SERIES = 12;
const IPCA_12M_ACCUMULATED_SERIES = 13522;
/** Meta Selic ao ano. Só o simulador precisa dela, e só pra calcular a poupança. */
const SELIC_TARGET_SERIES = 432;

/**
 * Só entra em cena se o Bacen estiver fora do ar ou devolver algo inesperado — a conta continua
 * saindo, mas com um número que não é o oficial. Por isso o chamador marca o resultado como
 * estimado: um CDI errado aqui vira dezenas de reais de diferença numa posição grande, e isso não
 * pode passar despercebido. Mantido perto do patamar atual justamente pra que, se um dia escapar,
 * o estrago seja pequeno.
 */
export const FALLBACK_CDI_RATE = 14.1;
export const FALLBACK_IPCA_RATE = 4.5;
export const FALLBACK_SELIC_RATE = 15.0;

/** A janela máxima que o SGS aceita por requisição é de 10 anos; períodos maiores vêm fatiados. */
const MAX_SERIES_WINDOW_DAYS = 3650;

function toBacenDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

/** "02/01/2026" -> Date à meia-noite UTC. */
function fromBacenDate(text: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

/**
 * `fetch` do Node embrulha qualquer falha de rede num "fetch failed" sem detalhe nenhum — a razão
 * de verdade (DNS, recusa de conexão, timeout, TLS) fica em `cause`, às vezes aninhada. Sem
 * desempacotar isso, um CDI que não chega vira um log inútil e a investigação começa do zero.
 */
function describeError(err: unknown): string {
  const parts: string[] = [];
  let atual: unknown = err;
  for (let i = 0; i < 4 && atual instanceof Error; i++) {
    const code = (atual as NodeJS.ErrnoException).code;
    parts.push(code ? `${atual.message} [${code}]` : atual.message);
    atual = (atual as { cause?: unknown }).cause;
  }
  return parts.join(" <- ");
}

@Injectable()
export class BacenProvider extends EconomicIndicatorProvider {
  private readonly logger = new Logger(BacenProvider.name);

  async fetchAnnualCdiRate(): Promise<number> {
    try {
      return await this.fetchLatestSeriesValue(CDI_ANNUALIZED_SERIES);
    } catch (err) {
      this.logger.warn(`Falling back to default CDI rate: ${describeError(err)}`);
      return FALLBACK_CDI_RATE;
    }
  }

  /**
   * As três taxas de uma vez, **sem** esconder a falha: `null` na que não veio.
   *
   * Os métodos acima devolvem o valor de reserva em silêncio, o que é certo pras telas de posição
   * (a conta precisa sair). Numa projeção de anos, não: um CDI de reserva vira milhares de reais de
   * diferença, e quem chama tem que poder avisar na tela que o número não é o oficial.
   */
  async fetchAnnualRatesOrNull(): Promise<{ cdi: number | null; ipca: number | null; selic: number | null }> {
    const tentar = async (serie: number) => {
      try {
        return await this.fetchLatestSeriesValue(serie);
      } catch {
        return null;
      }
    };

    const [cdi, ipca, selic] = await Promise.all([
      tentar(CDI_ANNUALIZED_SERIES),
      tentar(IPCA_12M_ACCUMULATED_SERIES),
      tentar(SELIC_TARGET_SERIES),
    ]);
    return { cdi, ipca, selic };
  }

  async fetchAnnualSelicRate(): Promise<number> {
    try {
      return await this.fetchLatestSeriesValue(SELIC_TARGET_SERIES);
    } catch (err) {
      this.logger.warn(`Falling back to default Selic rate: ${describeError(err)}`);
      return FALLBACK_SELIC_RATE;
    }
  }

  async fetchAnnualIpcaRate(): Promise<number> {
    try {
      return await this.fetchLatestSeriesValue(IPCA_12M_ACCUMULATED_SERIES);
    } catch (err) {
      this.logger.warn(`Falling back to default IPCA rate: ${describeError(err)}`);
      return FALLBACK_IPCA_RATE;
    }
  }

  async fetchDailyCdiSeries(from: Date, to: Date): Promise<DailyRatePoint[] | null> {
    if (from.getTime() > to.getTime()) return [];

    try {
      const points: DailyRatePoint[] = [];
      // Fatiado porque o SGS recusa janelas muito longas; um CDB de 5 anos passaria do limite.
      for (let inicio = new Date(from); inicio.getTime() <= to.getTime(); ) {
        const fim = new Date(Math.min(inicio.getTime() + MAX_SERIES_WINDOW_DAYS * 86_400_000, to.getTime()));
        points.push(...(await this.fetchSeriesWindow(CDI_DAILY_SERIES, inicio, fim)));
        inicio = new Date(fim.getTime() + 86_400_000);
      }
      return points;
    } catch (err) {
      // null (e não lista vazia) é a diferença entre "não consegui perguntar" e "não teve dia útil
      // nenhum no período" — só o primeiro caso deve derrubar o cálculo pra taxa anual.
      this.logger.warn(`Daily CDI series unavailable: ${describeError(err)}`);
      return null;
    }
  }

  private async fetchSeriesWindow(seriesCode: number, from: Date, to: Date): Promise<DailyRatePoint[]> {
    const url =
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados` +
      `?formato=json&dataInicial=${toBacenDate(from)}&dataFinal=${toBacenDate(to)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Bacen SGS request failed for series ${seriesCode}: ${res.status}`);

    const body = (await res.json()) as { data?: string; valor?: string }[];
    if (!Array.isArray(body)) throw new Error(`Bacen SGS returned an unexpected shape for series ${seriesCode}`);

    const points: DailyRatePoint[] = [];
    for (const row of body) {
      const date = row.data ? fromBacenDate(row.data) : null;
      const value = row.valor !== undefined ? Number(row.valor) : NaN;
      // Linha estranha é pulada em vez de derrubar a série inteira — um dia faltando custa
      // centavos, e é melhor que perder o período todo e cair na estimativa.
      if (date && !Number.isNaN(value)) points.push({ date, value });
    }
    return points;
  }

  private async fetchLatestSeriesValue(seriesCode: number): Promise<number> {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados/ultimos/1?formato=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Bacen SGS request failed for series ${seriesCode}: ${res.status}`);

    const body = (await res.json()) as { valor?: string }[];
    const raw = body?.[0]?.valor;
    const value = raw !== undefined ? Number(raw) : NaN;
    if (Number.isNaN(value)) throw new Error(`Bacen SGS returned no usable value for series ${seriesCode}`);

    return value;
  }
}
