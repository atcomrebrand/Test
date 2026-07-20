import { Injectable, Logger } from "@nestjs/common";
import { EconomicIndicatorProvider } from "../../domain/market-data.provider";

/** SGS (Sistema Gerenciador de Séries Temporais) series codes from the Banco Central open API. */
const CDI_ANNUALIZED_SERIES = 4392;
const IPCA_12M_ACCUMULATED_SERIES = 13522;

/** Used only if the Bacen API is unreachable or returns an unexpected shape — keeps fixed-income
 *  math working (with a clearly conservative estimate) instead of failing the whole calculation. */
const FALLBACK_CDI_RATE = 10.75;
const FALLBACK_IPCA_RATE = 4.5;

@Injectable()
export class BacenProvider extends EconomicIndicatorProvider {
  private readonly logger = new Logger(BacenProvider.name);

  async fetchAnnualCdiRate(): Promise<number> {
    try {
      return await this.fetchLatestSeriesValue(CDI_ANNUALIZED_SERIES);
    } catch (err) {
      this.logger.warn(`Falling back to default CDI rate: ${(err as Error).message}`);
      return FALLBACK_CDI_RATE;
    }
  }

  async fetchAnnualIpcaRate(): Promise<number> {
    try {
      return await this.fetchLatestSeriesValue(IPCA_12M_ACCUMULATED_SERIES);
    } catch (err) {
      this.logger.warn(`Falling back to default IPCA rate: ${(err as Error).message}`);
      return FALLBACK_IPCA_RATE;
    }
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
