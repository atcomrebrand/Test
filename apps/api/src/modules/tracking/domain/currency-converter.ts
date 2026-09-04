export type TrackingCurrencyCode = "BRL" | "USD";

/**
 * BRL passes through unchanged (no rate needed). USD needs `usdToBrlRate` — when it's null (the
 * FX provider is unreachable and nothing was ever cached), returns null instead of guessing, so
 * callers can decide how to degrade (skip the conversion, show "cotação indisponível", etc.)
 * rather than silently showing a wrong number.
 */
export function convertToBRL(amount: number, currency: TrackingCurrencyCode, usdToBrlRate: number | null): number | null {
  if (currency === "BRL") return amount;
  if (usdToBrlRate === null) return null;
  return Math.round(amount * usdToBrlRate * 100) / 100;
}
