import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvestmentAsset, InvestmentTransaction } from "@prisma/client";
import { mapWithConcurrency } from "../../../common/utils/concurrency";
import { AssetRepository } from "../domain/asset.repository";
import { ChartRangeOptions } from "../domain/market-data.provider";
import { calculatePosition } from "../domain/position-calculator";
import { calculateStakingYield } from "../domain/staking-calculator";
import { MarketPriceService } from "../infrastructure/market-price.service";
import { DividendAutoSyncService } from "./dividend-auto-sync.service";
import { AddAssetIncomeDto, CreateAssetDto, CreateTransactionDto, UpdateAssetDto, UpdateIncomeDto, UpdateTransactionDto } from "./dto/asset.dto";

/** Caps how many quote lookups run at once. Firing one BRAPI/CoinGecko request per asset with no
 *  limit (as a plain Promise.all would) works fine for a handful of assets, but a portfolio just
 *  bulk-imported from a B3 statement can easily have 20+ — and each fractional-lot ticker (BBAS3F,
 *  SAPR4F...) tries two requests (the exact ticker, then its round-lot fallback, since BRAPI never
 *  has fractional-specific quotes), so that burst can hit 30+ simultaneous requests. BRAPI's free
 *  tier rate-limits hard, so some of those come back empty — not because the price doesn't exist,
 *  but because too many requests landed in the same second. Serializing into small batches keeps
 *  every lookup within the rate limit instead of losing a random subset of them. */
const QUOTE_FETCH_CONCURRENCY = 4;

@Injectable()
export class AssetsService {
  constructor(
    private readonly assets: AssetRepository,
    private readonly marketPrice: MarketPriceService,
    private readonly dividendSync: DividendAutoSyncService,
  ) {}

  async findAll(userId: string, assetClass?: string, forceRefresh = false) {
    const rows = await this.assets.findAllByUser(userId, assetClass);
    return mapWithConcurrency(rows, QUOTE_FETCH_CONCURRENCY, async (asset) => {
      const transactions = await this.assets.listTransactions(asset.id);
      return this.enrich(asset, transactions, forceRefresh);
    });
  }

  async findOne(userId: string, id: string) {
    const asset = await this.getOwned(userId, id);
    const full = await this.assets.findByIdWithTransactions(id);
    if (!full) throw new NotFoundException("Ativo não encontrado.");
    const enriched = await this.enrich(asset, full.transactions);
    // enrich() just ran the dividend sync (see below) — re-reads incomes instead of reusing
    // full.incomes (captured before that sync) so a newly-recorded payment shows up immediately
    // instead of only on the next request.
    const incomeHistory = await this.assets.listIncomes(id);
    return { ...enriched, transactions: full.transactions, incomeHistory };
  }

  /** Live price + change% + price history + fundamentals — the asset detail page. */
  async getQuoteDetail(userId: string, id: string, forceRefresh = false) {
    const asset = await this.getOwned(userId, id);
    const detail = await this.marketPrice.getDetail(asset.class, asset.ticker, { forceRefresh });
    return { ticker: asset.ticker, class: asset.class, name: asset.name, detail };
  }

  /** Price history for the chart's time-range selector — a separate fetch from getQuoteDetail so
   *  switching ranges doesn't disturb the cached price/fundamentals shown alongside it. */
  async getHistory(userId: string, id: string, options: ChartRangeOptions) {
    const asset = await this.getOwned(userId, id);
    return this.marketPrice.getHistory(asset.class, asset.ticker, options);
  }

  create(userId: string, dto: CreateAssetDto) {
    return this.assets.create({
      userId,
      class: dto.class,
      ticker: dto.ticker.toUpperCase(),
      name: dto.name,
      broker: dto.broker,
      wallet: dto.wallet,
      network: dto.network,
      notes: dto.notes,
    });
  }

  async update(userId: string, id: string, dto: UpdateAssetDto) {
    await this.getOwned(userId, id);
    return this.assets.update(id, dto as Record<string, unknown>);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.assets.softDelete(id);
    return { id };
  }

  async addTransaction(userId: string, assetId: string, dto: CreateTransactionDto) {
    const asset = await this.getOwned(userId, assetId);
    if (dto.type === "SELL") {
      const existing = await this.assets.listTransactions(assetId);
      const position = calculatePosition(
        existing.map((t) => ({ type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate })),
      );
      if (dto.quantity > position.quantity) {
        throw new BadRequestException("Quantidade de venda maior que a posição atual.");
      }
    }
    const transaction = await this.assets.addTransaction({
      userId,
      assetId: asset.id,
      type: dto.type,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      fees: dto.fees ?? 0,
      transactionDate: new Date(dto.transactionDate),
      notes: dto.notes,
    });
    // A new BUY/SELL can change which historical dividend events the position now entitles (or no
    // longer entitles) — recalculated automatically, no separate "check for proventos" step.
    await this.dividendSync.syncAsset(userId, asset.id);
    return transaction;
  }

  async addIncome(userId: string, assetId: string, dto: AddAssetIncomeDto) {
    await this.getOwned(userId, assetId);
    return this.assets.addIncome({
      userId,
      assetId,
      type: dto.type,
      amount: dto.amount,
      paymentDate: new Date(dto.paymentDate),
      notes: dto.notes,
    });
  }

  /** All of a user's transactions/incomes across every asset, ticker included — powers the
   *  "Lançamentos" management page (a global place to correct or remove entries, notably useful
   *  right after a bulk import). */
  listAllTransactions(userId: string) {
    return this.assets.listAllTransactionsByUser(userId);
  }

  listAllIncomes(userId: string) {
    return this.assets.listAllIncomesByUser(userId);
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateTransactionDto) {
    await this.getOwnedTransaction(userId, transactionId);
    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) data.unitPrice = dto.unitPrice;
    if (dto.fees !== undefined) data.fees = dto.fees;
    if (dto.transactionDate !== undefined) data.transactionDate = new Date(dto.transactionDate);
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.assets.updateTransaction(transactionId, data);
  }

  async removeTransaction(userId: string, transactionId: string) {
    await this.getOwnedTransaction(userId, transactionId);
    await this.assets.deleteTransaction(transactionId);
    return { id: transactionId };
  }

  async updateIncome(userId: string, incomeId: string, dto: UpdateIncomeDto) {
    await this.getOwnedIncome(userId, incomeId);
    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.paymentDate !== undefined) data.paymentDate = new Date(dto.paymentDate);
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.assets.updateIncome(incomeId, data);
  }

  async removeIncome(userId: string, incomeId: string) {
    await this.getOwnedIncome(userId, incomeId);
    await this.assets.deleteIncome(incomeId);
    return { id: incomeId };
  }

  private async getOwnedTransaction(userId: string, transactionId: string) {
    const transaction = await this.assets.findTransactionById(transactionId);
    if (!transaction) throw new NotFoundException("Lançamento não encontrado.");
    if (transaction.userId !== userId) throw new ForbiddenException();
    return transaction;
  }

  private async getOwnedIncome(userId: string, incomeId: string) {
    const income = await this.assets.findIncomeById(incomeId);
    if (!income) throw new NotFoundException("Provento não encontrado.");
    if (income.userId !== userId) throw new ForbiddenException();
    return income;
  }

  private async enrich(asset: InvestmentAsset, transactions: InvestmentTransaction[], forceRefresh = false) {
    // Keeps dividendsReceived/dividendYield accurate everywhere this asset is shown — the
    // Portfolio list and the investments Dashboard both go through findAll(), not just the
    // asset's own detail page — without requiring the user to open every asset individually
    // first. No-ops instantly for CRYPTO (checked inside syncAsset) and is best-effort: a
    // BRAPI/Yahoo hiccup here must never break listing the asset.
    await this.dividendSync.syncAsset(asset.userId, asset.id);

    const position = calculatePosition(
      transactions.map((t) => ({ type: t.type, quantity: Number(t.quantity), unitPrice: Number(t.unitPrice), fees: Number(t.fees), transactionDate: t.transactionDate })),
    );

    const priceResult = position.quantity > 0 ? await this.marketPrice.getPrice(asset.class, asset.ticker, { forceRefresh }) : null;
    const currentPrice = priceResult?.price ?? null;
    const priceIsApproximate = priceResult?.approximate ?? false;
    const currentValue = currentPrice !== null ? position.quantity * currentPrice : null;
    const profit = currentValue !== null ? currentValue - position.investedAmount : null;
    const profitPercent = currentValue !== null && position.investedAmount > 0 ? (profit! / position.investedAmount) * 100 : null;

    const dividendsReceived = await this.assets.listIncomes(asset.id).then((incomes) => incomes.reduce((sum, i) => sum + Number(i.amount), 0));
    const dividendYield = currentValue && currentValue > 0 ? (dividendsReceived / currentValue) * 100 : null;

    const staking = this.estimateStaking(asset, position, transactions);

    return {
      ...asset,
      position,
      currentPrice,
      priceIsApproximate,
      currentValue,
      profit,
      profitPercent,
      dividendsReceived,
      dividendYield,
      staking,
    };
  }

  /** Estimated (not realized) staking yield since the asset's first buy, at the user-configured
   *  APY — informational only, never mixed into profit/dashboard totals. Real payouts should be
   *  logged as a STAKING income entry, which does count toward totals like any other income.
   *  Only stakingPercent of the position is assumed staked (defaults to 100% for configs made
   *  before that field existed), since most people don't stake their entire holding. */
  private estimateStaking(asset: InvestmentAsset, position: ReturnType<typeof calculatePosition>, transactions: InvestmentTransaction[]) {
    if (!asset.stakingApyPercent || position.quantity <= 0) return null;

    const buyDates = transactions.filter((t) => t.type === "BUY").map((t) => t.transactionDate.getTime());
    if (buyDates.length === 0) return null;
    const sinceDate = new Date(Math.min(...buyDates));

    const stakingPercent = asset.stakingPercent !== null && asset.stakingPercent !== undefined ? Number(asset.stakingPercent) : 100;
    const stakedAmount = position.investedAmount * (stakingPercent / 100);

    const result = calculateStakingYield({
      investedAmount: stakedAmount,
      apyPercent: Number(asset.stakingApyPercent),
      sinceDate,
      asOfDate: new Date(),
    });

    return { apyPercent: Number(asset.stakingApyPercent), stakingPercent, stakedAmount, sinceDate, ...result };
  }

  private async getOwned(userId: string, id: string) {
    const asset = await this.assets.findById(id);
    if (!asset || asset.deletedAt) throw new NotFoundException("Ativo não encontrado.");
    if (asset.userId !== userId) throw new ForbiddenException();
    return asset;
  }
}
