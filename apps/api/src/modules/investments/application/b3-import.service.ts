import { Injectable } from "@nestjs/common";
import { AssetRepository } from "../domain/asset.repository";
import {
  B3MovimentacaoRow,
  B3NegociacaoRow,
  ImportAssetClass,
  ImportedIncome,
  ImportedTransaction,
  SkippedRow,
  parseB3Import,
} from "../domain/b3-import";
import { parseSimpleCsvImport, SimpleImportRow } from "../domain/simple-csv-import";
import { calculatePosition } from "../domain/position-calculator";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";
import { ImportIncomeInputDto, ImportTransactionInputDto } from "./dto/b3-import.dto";

const AMOUNT_TOLERANCE = 0.2; // 20% relative tolerance when matching a suggested dividend to one already on file
const DATE_TOLERANCE_DAYS = 5;

export interface DividendSuggestion {
  ticker: string;
  assetClass: ImportAssetClass;
  type: "DIVIDENDO" | "JCP" | "OUTRO";
  amount: number;
  paymentDate: string;
  exDate: string | null;
  relatedTo: string | null;
  quantityHeld: number;
}

export interface B3ImportPreviewResult {
  transactions: ImportedTransaction[];
  incomes: ImportedIncome[];
  skipped: SkippedRow[];
  suggestedIncomes: DividendSuggestion[];
  duplicateTransactionsSkipped: number;
  duplicateIncomesSkipped: number;
}

type ExistingTransaction = Awaited<ReturnType<AssetRepository["listAllTransactionsByUser"]>>[number];
type ExistingIncome = Awaited<ReturnType<AssetRepository["listAllIncomesByUser"]>>[number];

/**
 * Orchestrates the B3 statement import: the domain parser (parseB3Import) does the pure
 * classification, this layer adds the two things that need the database — deduping against
 * whatever the user already has on file (so re-uploading an overlapping statement is harmless),
 * and cross-checking BRAPI's dividend history for payment events the statement doesn't cover
 * (surfaced as suggestions the user must explicitly confirm, never auto-added).
 */
@Injectable()
export class B3ImportService {
  constructor(
    private readonly assets: AssetRepository,
    private readonly dividendsCache: DividendsCacheService,
  ) {}

  async preview(userId: string, negociacaoRows: Record<string, unknown>[], movimentacaoRows: Record<string, unknown>[]): Promise<B3ImportPreviewResult> {
    const plan = parseB3Import(negociacaoRows as unknown as B3NegociacaoRow[], movimentacaoRows as unknown as B3MovimentacaoRow[]);
    return this.buildPreview(userId, plan.transactions, plan.incomes, plan.skipped);
  }

  /** Simpler CSV format (one row per transaction, no dividend/provento rows at all) — the
   *  dividend-suggestion pass below runs the same regardless of import source, since it's driven
   *  by BRAPI's dividend history against the position these transactions establish, not by
   *  anything in the source file itself. */
  async previewCsv(userId: string, rows: Record<string, unknown>[]): Promise<B3ImportPreviewResult> {
    const plan = parseSimpleCsvImport(rows as unknown as SimpleImportRow[]);
    return this.buildPreview(userId, plan.transactions, [], plan.skipped);
  }

  private async buildPreview(
    userId: string,
    planTransactions: ImportedTransaction[],
    planIncomes: ImportedIncome[],
    planSkipped: SkippedRow[],
  ): Promise<B3ImportPreviewResult> {
    const [existingTransactions, existingIncomes] = await Promise.all([
      this.assets.listAllTransactionsByUser(userId),
      this.assets.listAllIncomesByUser(userId),
    ]);

    const existingTxKeys = new Set(
      existingTransactions.map((t) =>
        transactionKey({ ticker: t.asset.ticker, type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), transactionDate: isoDate(t.transactionDate) }),
      ),
    );
    const existingIncomeKeys = new Set(
      existingIncomes.map((i) => incomeKey({ ticker: i.asset!.ticker, type: i.type, amount: Number(i.amount), paymentDate: isoDate(i.paymentDate) })),
    );

    const transactions = planTransactions.filter((t) => !existingTxKeys.has(transactionKey(t)));
    const incomes = planIncomes.filter((i) => !existingIncomeKeys.has(incomeKey(i)));

    const suggestedIncomes = await this.buildDividendSuggestions(transactions, incomes, existingTransactions, existingIncomes);

    return {
      transactions,
      incomes,
      skipped: planSkipped,
      suggestedIncomes,
      duplicateTransactionsSkipped: planTransactions.length - transactions.length,
      duplicateIncomesSkipped: planIncomes.length - incomes.length,
    };
  }

  async commit(userId: string, transactions: ImportTransactionInputDto[], incomes: ImportIncomeInputDto[]) {
    const assetCache = new Map<string, { id: string }>();
    let createdAssets = 0;

    const resolveAsset = async (ticker: string, assetClass: string, name: string | undefined) => {
      const key = `${assetClass}:${ticker}`;
      const cached = assetCache.get(key);
      if (cached) return cached;
      let asset = await this.assets.findByUserAndTicker(userId, assetClass, ticker);
      if (!asset) {
        asset = await this.assets.create({ userId, class: assetClass, ticker, name });
        createdAssets++;
      }
      assetCache.set(key, asset);
      return asset;
    };

    for (const t of transactions) {
      const asset = await resolveAsset(t.ticker, t.assetClass, t.assetName);
      await this.assets.addTransaction({
        userId,
        assetId: asset.id,
        type: t.type,
        quantity: t.quantity,
        unitPrice: t.unitPrice,
        fees: 0,
        transactionDate: new Date(t.transactionDate),
        notes: t.sourceLabel ? `Importado da B3: ${t.sourceLabel}` : "Importado da B3",
      });
    }

    for (const i of incomes) {
      const asset = await resolveAsset(i.ticker, i.assetClass, i.assetName);
      await this.assets.addIncome({
        userId,
        assetId: asset.id,
        type: i.type,
        amount: i.amount,
        paymentDate: new Date(i.paymentDate),
        notes: i.sourceLabel ? `Importado da B3: ${i.sourceLabel}` : "Importado da B3",
      });
    }

    return { createdAssets, importedTransactions: transactions.length, importedIncomes: incomes.length };
  }

  /** BRAPI's dividend history can surface payments the statement itself didn't cover (e.g. an
   *  older period outside the export's date range) — computed against the exact position the
   *  user held at the ex-dividend date, from every transaction (existing + newly imported). */
  private async buildDividendSuggestions(
    newTransactions: ImportedTransaction[],
    newIncomes: ImportedIncome[],
    existingTransactions: ExistingTransaction[],
    existingIncomes: ExistingIncome[],
  ): Promise<DividendSuggestion[]> {
    const tickerClass = new Map<string, ImportAssetClass>();
    for (const t of newTransactions) tickerClass.set(t.ticker, t.assetClass);
    for (const t of existingTransactions) tickerClass.set(t.asset.ticker, t.asset.class as ImportAssetClass);

    const txsByTicker = new Map<string, { type: "BUY" | "SELL"; quantity: number; unitPrice: number; fees: number; transactionDate: Date }[]>();
    const pushTx = (ticker: string, tx: { type: "BUY" | "SELL"; quantity: number; unitPrice: number; fees: number; transactionDate: Date }) => {
      const arr = txsByTicker.get(ticker) ?? [];
      arr.push(tx);
      txsByTicker.set(ticker, arr);
    };
    for (const t of newTransactions) pushTx(t.ticker, { type: t.type, quantity: t.quantity, unitPrice: t.unitPrice, fees: 0, transactionDate: new Date(t.transactionDate) });
    for (const t of existingTransactions) {
      pushTx(t.asset.ticker, { type: t.type as "BUY" | "SELL", quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate });
    }

    const knownIncomes = [
      ...newIncomes.map((i) => ({ ticker: i.ticker, amount: i.amount, paymentDate: i.paymentDate })),
      ...existingIncomes.map((i) => ({ ticker: i.asset!.ticker, amount: Number(i.amount), paymentDate: isoDate(i.paymentDate) })),
    ];

    const suggestions: DividendSuggestion[] = [];
    for (const [ticker, assetClass] of tickerClass) {
      const events = await this.dividendsCache.get(ticker);
      const txs = txsByTicker.get(ticker) ?? [];

      for (const event of events) {
        // Position (and thus entitlement) is determined at the ex-date; whether the payment is
        // already "on file" is judged against the payment date instead — the two are typically
        // weeks apart, so comparing across them would make every real match look unrelated.
        const positionAsOfDate = event.exDate ?? event.paymentDate;
        const comparisonDate = event.paymentDate ?? event.exDate;
        if (!positionAsOfDate || !comparisonDate) continue;

        const heldAsOf = txs.filter((t) => isoDate(t.transactionDate) <= positionAsOfDate);
        const quantityHeld = calculatePosition(heldAsOf).quantity;
        if (quantityHeld <= 0) continue;

        const estimatedAmount = Math.round(event.rate * quantityHeld * 100) / 100;
        const alreadyOnFile = knownIncomes.some(
          (known) => known.ticker === ticker && isCloseMatch(known.paymentDate, comparisonDate) && isWithinTolerance(known.amount, estimatedAmount),
        );
        if (alreadyOnFile) continue;

        suggestions.push({
          ticker,
          assetClass,
          type: event.type,
          amount: estimatedAmount,
          paymentDate: comparisonDate,
          exDate: event.exDate,
          relatedTo: event.relatedTo,
          quantityHeld,
        });
      }
    }

    return suggestions.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function transactionKey(t: { ticker: string; type: string; quantity: number; unitPrice: number; transactionDate: string }): string {
  return `${t.ticker}|${t.type}|${t.quantity}|${t.unitPrice}|${t.transactionDate}`;
}

function incomeKey(i: { ticker: string; type: string; amount: number; paymentDate: string }): string {
  return `${i.ticker}|${i.type}|${i.amount}|${i.paymentDate}`;
}

function isCloseMatch(dateA: string, dateB: string): boolean {
  const daysDiff = Math.abs((new Date(dateA).getTime() - new Date(dateB).getTime()) / 86400000);
  return daysDiff <= DATE_TOLERANCE_DAYS;
}

function isWithinTolerance(a: number, b: number): boolean {
  const rel = Math.abs(a - b) / Math.max(a, b, 0.01);
  return rel <= AMOUNT_TOLERANCE;
}
