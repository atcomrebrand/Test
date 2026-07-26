import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancingRepository } from "../domain/financing.repository";
import { generateFixedInstallments } from "../domain/financing-installment-generator";
import {
  CreateFinancingDto,
  PayFinancingInstallmentDto,
  UpdateFinancingDto,
  UpdateFinancingInstallmentStatusDto,
  UpdatePayoffDto,
} from "./dto/financing.dto";

/** How far back we look to judge whether a new payoff quote is the best one seen lately. */
const PAYOFF_COMPARISON_WINDOW_MONTHS = 3;

@Injectable()
export class FinancingsService {
  constructor(private readonly financings: FinancingRepository) {}

  async findAll(userId: string) {
    await this.financings.refreshLateStatuses(userId);
    return this.financings.findAllByUser(userId);
  }

  async findOne(userId: string, id: string) {
    const financing = await this.getOwned(userId, id);
    return this.financings.findByIdWithInstallments(financing.id);
  }

  async summary(userId: string) {
    await this.financings.refreshLateStatuses(userId);
    return this.financings.summary(userId);
  }

  async create(userId: string, dto: CreateFinancingDto) {
    const nextDueDate = new Date(dto.nextDueDate);
    const paidInstallmentsCount = dto.paidInstallmentsCount ?? 0;
    if (paidInstallmentsCount >= dto.installmentsCount) {
      throw new BadRequestException("Número de parcelas pagas deve ser menor que o número total de parcelas.");
    }

    const installments = generateFixedInstallments({
      nextDueDate,
      installmentAmount: dto.installmentAmount,
      installmentsCount: dto.installmentsCount,
      paidInstallmentsCount,
    });

    const payoffQuotedAt = dto.payoffAmount !== undefined ? new Date(dto.payoffQuotedAt ?? Date.now()) : undefined;

    const financing = await this.financings.createWithInstallments(
      {
        userId,
        name: dto.name,
        kind: dto.kind,
        institution: dto.institution,
        totalAmount: dto.totalAmount,
        installmentAmount: dto.installmentAmount,
        installmentsCount: dto.installmentsCount,
        firstDueDate: installments[0].dueDate,
        payoffAmount: dto.payoffAmount,
        payoffQuotedAt,
        notes: dto.notes,
      },
      installments,
    );

    if (dto.payoffAmount !== undefined && payoffQuotedAt) {
      await this.financings.addPayoffQuote(userId, financing.id, dto.payoffAmount, payoffQuotedAt);
    }

    return this.financings.findByIdWithInstallments(financing.id);
  }

  async update(userId: string, id: string, dto: UpdateFinancingDto) {
    await this.getOwned(userId, id);
    await this.financings.update(id, dto as Record<string, unknown>);
    return this.financings.findByIdWithInstallments(id);
  }

  /**
   * Records a new cash-payoff quote and reports how it stacks up: percent change from the
   * previous quote, and whether it's the best (lowest) one seen in the last few months — so the
   * user doesn't have to remember every proposal the lender has sent.
   */
  async updatePayoff(userId: string, id: string, dto: UpdatePayoffDto) {
    const financing = await this.getOwned(userId, id);
    const quotedAt = dto.payoffQuotedAt ? new Date(dto.payoffQuotedAt) : new Date();

    const windowStart = new Date(quotedAt);
    windowStart.setMonth(windowStart.getMonth() - PAYOFF_COMPARISON_WINDOW_MONTHS);
    const priorQuotesInWindow = await this.financings.listPayoffQuotesSince(id, windowStart);

    const previousAmount = financing.payoffAmount !== null ? Number(financing.payoffAmount) : null;
    const percentChange = previousAmount && previousAmount > 0 ? ((dto.payoffAmount - previousAmount) / previousAmount) * 100 : null;

    const priorMin = priorQuotesInWindow.length > 0 ? Math.min(...priorQuotesInWindow.map((q) => q.amount)) : null;
    const isBestInWindow = priorMin === null || dto.payoffAmount <= priorMin;
    const bestInWindowAmount = priorMin === null ? dto.payoffAmount : Math.min(priorMin, dto.payoffAmount);

    await this.financings.addPayoffQuote(userId, id, dto.payoffAmount, quotedAt);
    await this.financings.update(id, { payoffAmount: dto.payoffAmount, payoffQuotedAt: quotedAt });

    return {
      financing: await this.financings.findByIdWithInstallments(id),
      comparison: {
        previousAmount,
        percentChange,
        isBestInWindow,
        windowMonths: PAYOFF_COMPARISON_WINDOW_MONTHS,
        bestInWindowAmount,
      },
    };
  }

  async payoffQuoteHistory(userId: string, id: string) {
    await this.getOwned(userId, id);
    return this.financings.listPayoffQuotes(id);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.financings.delete(id);
    return { id };
  }

  async payInstallment(userId: string, installmentId: string, dto: PayFinancingInstallmentDto) {
    const installment = await this.getOwnedInstallment(userId, installmentId);
    if (installment.status === "PAID") throw new BadRequestException("Parcela já está paga.");
    if (installment.status === "CANCELLED") throw new BadRequestException("Parcela cancelada não pode ser paga.");

    const paidAmount = dto.paidAmount ?? Number(installment.amount);
    return this.financings.payInstallment(userId, installmentId, paidAmount);
  }

  async unpayInstallment(userId: string, installmentId: string) {
    const installment = await this.getOwnedInstallment(userId, installmentId);
    if (installment.status !== "PAID") throw new BadRequestException("Parcela não está paga.");
    return this.financings.unpayInstallment(installmentId);
  }

  async updateInstallmentStatus(userId: string, installmentId: string, dto: UpdateFinancingInstallmentStatusDto) {
    const installment = await this.getOwnedInstallment(userId, installmentId);
    if (installment.status === "PAID") {
      throw new BadRequestException("Use a rota de pagamento para reverter uma parcela paga.");
    }
    return this.financings.updateInstallmentStatus(installmentId, dto.status);
  }

  private async getOwned(userId: string, id: string) {
    const financing = await this.financings.findById(id);
    if (!financing) throw new NotFoundException("Financiamento não encontrado.");
    if (financing.userId !== userId) throw new ForbiddenException();
    return financing;
  }

  private async getOwnedInstallment(userId: string, id: string) {
    const installment = await this.financings.findInstallmentById(id);
    if (!installment) throw new NotFoundException("Parcela não encontrada.");
    if (installment.userId !== userId) throw new ForbiddenException();
    return installment;
  }
}
