import { Injectable } from "@nestjs/common";
import { EconomicIndicatorProvider } from "../domain/market-data.provider";

const TTL_MS = 6 * 60 * 60 * 1000;

/** In-memory TTL cache in front of BacenProvider — CDI/IPCA move at most once a day, and losing
 *  the cache on a restart is harmless (it just refetches once), so no DB table is needed. */
@Injectable()
export class EconomicIndicatorCacheService {
  private cdi: { value: number; fetchedAt: number } | null = null;
  private ipca: { value: number; fetchedAt: number } | null = null;

  constructor(private readonly provider: EconomicIndicatorProvider) {}

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
}
