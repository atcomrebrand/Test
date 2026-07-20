import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvestmentAsset, InvestmentTransaction } from "@prisma/client";
import { AssetRepository } from "../domain/asset.repository";
import { ChartRangeOptions } from "../domain/market-data.provider";
import { calculatePosition } from "../domain/position-calculator";
import { calculateStakingYield } from "../domain/staking-calculator";
import { MarketPriceService } from "../infrastructure/market-price.service";
import { AddAssetIncomeDto, CreateAssetDto, CreateTransactionDto, UpdateAssetDto } from "./dto/asset.dto";

@Injectable()
export class AssetsService {
  constructor(
    private readonly assets: AssetRepository,
    private readonly marketPrice: MarketPriceService,
  ) {}

  async findAll(userId: string, assetClass?: string, forceRefresh = false) {
    const rows = await this.assets.findAllByUser(userId, assetClass);
    return Promise.all(
      rows.map(async (asset) => {
        const transactions = await this.assets.listTransactions(asset.id);
        return this.enrich(asset, transactions, forceRefresh);
      }),
    );
  }

  async findOne(userId: string, id: string) {
    const asset = await this.getOwned(userId, id);
    const full = await this.assets.findByIdWithTransactions(id);
    if (!full) throw new NotFoundException("Ativo não encontrado.");
    const enriched = await this.enrich(asset, full.transactions);
    return { ...enriched, transactions: full.transactions, incomeHistory: full.incomes };
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
      stakingApyPercent: dto.stakingApyPercent,
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
    return this.assets.addTransaction({
      userId,
      assetId: asset.id,
      type: dto.type,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      fees: dto.fees ?? 0,
      transactionDate: new Date(dto.transactionDate),
      notes: dto.notes,
    });
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

  private async enrich(asset: InvestmentAsset, transactions: InvestmentTransaction[], forceRefresh = false) {
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
   *  logged as a STAKING income entry, which does count toward totals like any other income. */
  private estimateStaking(asset: InvestmentAsset, position: ReturnType<typeof calculatePosition>, transactions: InvestmentTransaction[]) {
    if (!asset.stakingApyPercent || position.quantity <= 0) return null;

    const buyDates = transactions.filter((t) => t.type === "BUY").map((t) => t.transactionDate.getTime());
    if (buyDates.length === 0) return null;
    const sinceDate = new Date(Math.min(...buyDates));

    const result = calculateStakingYield({
      investedAmount: position.investedAmount,
      apyPercent: Number(asset.stakingApyPercent),
      sinceDate,
      asOfDate: new Date(),
    });

    return { apyPercent: Number(asset.stakingApyPercent), sinceDate, ...result };
  }

  private async getOwned(userId: string, id: string) {
    const asset = await this.assets.findById(id);
    if (!asset || asset.deletedAt) throw new NotFoundException("Ativo não encontrado.");
    if (asset.userId !== userId) throw new ForbiddenException();
    return asset;
  }
}
