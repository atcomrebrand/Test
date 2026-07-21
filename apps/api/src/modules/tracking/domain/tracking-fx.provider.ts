/** Decoupled from TrackingFxService (which adds caching) so swapping the FX source later only
 *  means writing a new class here, same pattern as market-data.provider.ts in investments. */
export abstract class TrackingFxRateProvider {
  abstract fetchUsdToBrl(): Promise<number>;
}
