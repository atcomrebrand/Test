import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InvestmentFixedIncome } from "@prisma/client";
import { FixedIncomeRepository } from "../domain/fixed-income.repository";
import { calculateFixedIncome } from "../domain/fixed-income-calculator";
import { EconomicIndicatorCacheService } from "../infrastructure/economic-indicator-cache.service";
import { AddFixedIncomeInterestDto, CreateFixedIncomeDto, RedeemFixedIncomeDto, UpdateFixedIncomeDto } from "./dto/fixed-income.dto";

@Injectable()
export class FixedIncomesService {
  constructor(
    private readonly fixedIncomes: FixedIncomeRepository,
    private readonly indicators: EconomicIndicatorCacheService,
  ) {}

  async findAll(userId: string) {
    const rows = await this.fixedIncomes.findAllByUser(userId);
    return Promise.all(rows.map((row) => this.enrich(row)));
  }

  async findOne(userId: string, id: string) {
    const fixedIncome = await this.getOwned(userId, id);
    const [enriched, incomes] = await Promise.all([this.enrich(fixedIncome), this.fixedIncomes.listIncomes(id)]);
    return { ...enriched, incomeHistory: incomes };
  }

  async create(userId: string, dto: CreateFixedIncomeDto) {
    const fixedIncome = await this.fixedIncomes.create({
      userId,
      institution: dto.institution,
      type: dto.type,
      principalAmount: dto.principalAmount,
      applicationDate: new Date(dto.applicationDate),
      maturityDate: new Date(dto.maturityDate),
      liquidity: dto.liquidity,
      indexer: dto.indexer,
      fixedRatePercent: dto.fixedRatePercent,
      cdiPercent: dto.cdiPercent,
      notes: dto.notes,
    });
    return this.enrich(fixedIncome);
  }

  async update(userId: string, id: string, dto: UpdateFixedIncomeDto) {
    await this.getOwned(userId, id);
    const updated = await this.fixedIncomes.update(id, dto as Record<string, unknown>);
    return this.enrich(updated);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.fixedIncomes.softDelete(id);
    return { id };
  }

  /** Marks the application as redeemed today (or a given date), locking in the net value at that moment. */
  async redeem(userId: string, id: string, dto: RedeemFixedIncomeDto) {
    const fixedIncome = await this.getOwned(userId, id);
    const redeemedAt = dto.redeemedAt ? new Date(dto.redeemedAt) : new Date();
    const calc = await this.calculate(fixedIncome, redeemedAt);
    const updated = await this.fixedIncomes.redeem(id, redeemedAt, calc.netValue);
    return this.enrich(updated);
  }

  async addInterest(userId: string, id: string, dto: AddFixedIncomeInterestDto) {
    await this.getOwned(userId, id);
    return this.fixedIncomes.addIncome({
      userId,
      fixedIncomeId: id,
      type: dto.type ?? "JUROS",
      amount: dto.amount,
      paymentDate: new Date(dto.paymentDate),
      notes: dto.notes,
    });
  }

  private async enrich(fixedIncome: InvestmentFixedIncome) {
    const asOfDate = fixedIncome.redeemedAt ?? new Date();
    const calc = await this.calculate(fixedIncome, asOfDate);
    return { ...fixedIncome, calculation: calc };
  }

  private async calculate(fixedIncome: InvestmentFixedIncome, asOfDate: Date) {
    const needsCdi = fixedIncome.indexer === "POS_FIXADO_CDI";
    const needsIpca = fixedIncome.indexer === "IPCA_MAIS";

    const [cdiAnnualRate, ipcaAnnualRate] = await Promise.all([
      needsCdi ? this.indicators.getAnnualCdiRate() : Promise.resolve(null),
      needsIpca ? this.indicators.getAnnualIpcaRate() : Promise.resolve(null),
    ]);

    return calculateFixedIncome({
      principalAmount: Number(fixedIncome.principalAmount),
      applicationDate: fixedIncome.applicationDate,
      asOfDate,
      type: fixedIncome.type,
      indexer: fixedIncome.indexer,
      fixedRatePercent: fixedIncome.fixedRatePercent ? Number(fixedIncome.fixedRatePercent) : null,
      cdiPercent: fixedIncome.cdiPercent ? Number(fixedIncome.cdiPercent) : null,
      cdiAnnualRate,
      ipcaAnnualRate,
    });
  }

  private async getOwned(userId: string, id: string) {
    const fixedIncome = await this.fixedIncomes.findById(id);
    if (!fixedIncome || fixedIncome.deletedAt) throw new NotFoundException("Aplicação não encontrada.");
    if (fixedIncome.userId !== userId) throw new ForbiddenException();
    return fixedIncome;
  }
}
