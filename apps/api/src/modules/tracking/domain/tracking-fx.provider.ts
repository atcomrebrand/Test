export interface FxQuote {
  rate: number;
  /** Previous trading day's close, when the source exposes it — lets callers show a rising/falling
   *  indicator. Null for sources that only expose a flat snapshot with no day-over-day reference
   *  (open.er-api.com, the CDN currency-api fallback). */
  previousClose: number | null;
}

/** Decoupled from TrackingFxService (which adds caching) so swapping the FX source later only
 *  means writing a new class here, same pattern as market-data.provider.ts in investments. */
export abstract class TrackingFxRateProvider {
  abstract fetchUsdToBrl(): Promise<FxQuote>;
}
