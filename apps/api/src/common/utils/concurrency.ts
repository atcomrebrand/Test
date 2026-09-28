/** Runs `fn` over every item with at most `limit` in flight at once — bounds how many concurrent
 *  external requests (BRAPI, CoinGecko...) a single operation fires, without silently truncating
 *  the item list the way a `.slice(0, N)` cap would. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
