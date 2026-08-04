import { Injectable, Logger } from "@nestjs/common";
import { AssetRepository } from "../domain/asset.repository";
import { isCloseMatch, isWithinTolerance } from "../domain/dividend-matching";
import { calculatePosition } from "../domain/position-calculator";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

/**
 * Keeps a STOCK/FII asset's recorded dividend/JCP income in sync with BRAPI's dividend history,
 * with no user action required: every BRAPI-reported event is valued against the position actually
 * held on its own ex-dividend date and, if not already on file, recorded as an InvestmentIncome
 * automatically. Runs whenever a transaction changes the asset's history (so a new BUY/SELL can
 * immediately surface newly-entitled or newly-irrelevant events) and whenever the asset is opened
 * (so older assets — or a BRAPI history that grew since the last visit — catch up too).
 *
 * Best-effort by design: dividend sync enriches data, it never gates the action that triggered it
 * (adding a transaction, importing a statement, opening the asset page) — a BRAPI hiccup here must
 * never surface as a failure of that action.
 */
@Injectable()
export class DividendAutoSyncService {
  private readonly logger = new Logger(DividendAutoSyncService.name);

  constructor(
    private readonly assets: AssetRepository,
    private readonly dividendsCache: DividendsCacheService,
  ) {}

  /** Returns how many new income records were created. */
  async syncAsset(userId: string, assetId: string): Promise<number> {
    try {
      const asset = await this.assets.findById(assetId);
      if (!asset || (asset.class !== "STOCK" && asset.class !== "FII")) return 0;

      const [transactions, existingIncomes] = await Promise.all([this.assets.listTransactions(assetId), this.assets.listIncomes(assetId)]);
      const txs = transactions.map((t) => ({ type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate }));
      const known = existingIncomes.map((i) => ({ amount: Number(i.amount), paymentDate: isoDate(i.paymentDate) }));

      const events = await this.dividendsCache.get(asset.ticker, asset.class);

      let created = 0;
      for (const event of events) {
        // Same convention as the B3 import's suggestion logic: entitlement (and thus the position
        // to value the event against) is determined at the ex-date; whether it's already on file
        // is judged against the payment date, since those are typically weeks apart.
        const positionAsOfDate = event.exDate ?? event.paymentDate;
        const comparisonDate = event.paymentDate ?? event.exDate;
        if (!positionAsOfDate || !comparisonDate) continue;

        const heldAsOf = txs.filter((t) => isoDate(t.transactionDate) <= positionAsOfDate);
        const quantityHeld = calculatePosition(heldAsOf).quantity;
        if (quantityHeld <= 0) continue;

        const estimatedAmount = Math.round(event.rate * quantityHeld * 100) / 100;
        // An income counts as already-on-file if it sits near EITHER of the event's dates, not
        // just the payment date. The dividend source can change between syncs (BRAPI → Fundamentus
        // → Yahoo fallbacks), and Yahoo only reports one date per event — the ex-date — which past
        // syncs recorded as the income's payment date. When a richer source later supplies the
        // real payment date (often months after the data-com), comparing against the payment date
        // alone re-created every one of those events as a duplicate (bug seen in production
        // 2026-08-04, first sync after the Fundamentus source landed).
        const eventDates = [event.paymentDate, event.exDate].filter((d): d is string => d !== null);
        const alreadyOnFile = known.some((k) => eventDates.some((d) => isCloseMatch(k.paymentDate, d)) && isWithinTolerance(k.amount, estimatedAmount));
        if (alreadyOnFile) continue;

        await this.assets.addIncome({
          userId,
          assetId,
          type: event.type,
          amount: estimatedAmount,
          // Noon, not midnight: a bare "YYYY-MM-DD" parses as UTC midnight, which rolls back to
          // the previous day once rendered in any negative-UTC timezone (all of Brazil) — same
          // anchor convention every manual date input in this app already uses.
          paymentDate: new Date(`${comparisonDate}T12:00:00`),
          notes: event.relatedTo ? `Calculado automaticamente (histórico BRAPI): ${event.relatedTo}` : "Calculado automaticamente (histórico BRAPI)",
        });
        known.push({ amount: estimatedAmount, paymentDate: comparisonDate });
        created++;
      }

      return created;
    } catch (err) {
      this.logger.warn(`Dividend sync failed for asset ${assetId}: ${(err as Error).message}`);
      return 0;
    }
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
