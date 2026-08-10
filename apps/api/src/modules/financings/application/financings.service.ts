import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Financing, FinancingInstallment } from "@prisma/client";
import { FinancingRepository } from "../domain/financing.repository";
import { generateFixedInstallments } from "../domain/financing-installment-generator";
import { computeFinancingEquity, sumFinancingEquity } from "../domain/financing-equity";
import { summarizeAssetValueHistory } from "../domain/asset-value-history";
import { parseAssetPhoto } from "../domain/asset-photo";
import {
  CreateFinancingDto,
  PayFinancingInstallmentDto,
  UpdateAssetPhotoDto,
  UpdateAssetValueDto,
  UpdateFinancingDto,
  UpdateFinancingInstallmentStatusDto,
  UpdatePayoffDto,
} from "./dto/financing.dto";

/** How far back we look to judge whether a new payoff quote is the best one seen lately. */
const PAYOFF_COMPARISON_WINDOW_MONTHS = 3;

type FinancingWithInstallments = Financing & { installments: FinancingInstallment[] };

@Injectable()
export class FinancingsService {
  constructor(private readonly financings: FinancingRepository) {}

  async findAll(userId: string) {
    await this.financings.refreshLateStatuses(userId);
    const financings = await this.financings.findAllByUser(userId);
    return financings.map((f) => this.present(f));
  }

  async findOne(userId: string, id: string) {
    const financing = await this.getOwned(userId, id);
    const full = await this.financings.findByIdWithInstallments(financing.id);
    return full ? this.present(full) : null;
  }

  async summary(userId: string) {
    await this.financings.refreshLateStatuses(userId);
    const [summary, financings] = await Promise.all([
      this.financings.summary(userId),
      this.financings.findAllByUser(userId),
    ]);

    // Patrimônio só dos ativos: um financiamento arquivado não tem mais dívida nem bem em jogo.
    const equity = sumFinancingEquity(
      financings.filter((f) => f.active).map((f) => this.equityInputFor(f)),
    );

    return { ...summary, equity };
  }

  /**
   * Anexa o patrimônio do bem ao financiamento — todo card que mostra dívida precisa mostrar
   * também o que o bem vale, senão o app só enxerga a metade negativa da conta.
   */
  private present(financing: FinancingWithInstallments) {
    return { ...financing, equity: computeFinancingEquity(this.equityInputFor(financing)) };
  }

  private equityInputFor(financing: FinancingWithInstallments) {
    return {
      assetValue: financing.assetValue !== null ? Number(financing.assetValue) : null,
      payoffAmount: financing.payoffAmount !== null ? Number(financing.payoffAmount) : null,
      remainingInstallments: financing.installments
        .filter((i) => i.status === "PENDING" || i.status === "LATE")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    };
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
    const assetValueAt = dto.assetValue !== undefined ? new Date(dto.assetValueAt ?? Date.now()) : undefined;

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
        assetValue: dto.assetValue,
        assetValueAt,
        notes: dto.notes,
      },
      installments,
    );

    if (dto.payoffAmount !== undefined && payoffQuotedAt) {
      await this.financings.addPayoffQuote(userId, financing.id, dto.payoffAmount, payoffQuotedAt);
    }
    // A avaliação informada na criação já entra no histórico — senão o primeiro ponto da série
    // só apareceria na segunda avaliação, e o gráfico começaria sem o ponto de partida.
    if (dto.assetValue !== undefined && assetValueAt) {
      await this.financings.addAssetValue(userId, financing.id, dto.assetValue, assetValueAt, dto.assetValueSource);
    }

    return this.findOne(userId, financing.id);
  }

  async update(userId: string, id: string, dto: UpdateFinancingDto) {
    await this.getOwned(userId, id);
    await this.financings.update(id, dto as Record<string, unknown>);
    return this.findOne(userId, id);
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
      financing: await this.findOne(userId, id),
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

  /**
   * Registra quanto o bem vale hoje. A avaliação nova não substitui a anterior: entra na série
   * (a FIPE muda todo mês) e só então vira o valor corrente do financiamento. Devolve o
   * patrimônio recalculado, porque é isso que muda na tela — a dívida continua a mesma, o que
   * mexeu foi o outro lado da conta.
   */
  async updateAssetValue(userId: string, id: string, dto: UpdateAssetValueDto) {
    const financing = await this.getOwned(userId, id);
    const valuedAt = dto.valuedAt ? new Date(dto.valuedAt) : new Date();

    const previousAmount = financing.assetValue !== null ? Number(financing.assetValue) : null;
    const percentChange =
      previousAmount && previousAmount > 0 ? ((dto.assetValue - previousAmount) / previousAmount) * 100 : null;

    await this.financings.addAssetValue(userId, id, dto.assetValue, valuedAt, dto.source);
    await this.financings.update(id, { assetValue: dto.assetValue, assetValueAt: valuedAt });

    const updated = await this.findOne(userId, id);
    return {
      financing: updated,
      comparison: {
        previousAmount,
        percentChange,
        trend: summarizeAssetValueHistory(await this.financings.listAssetValues(id)),
      },
    };
  }

  /**
   * Guarda (ou remove, com `photo: null`) a foto do bem. O cliente já manda redimensionada, mas a
   * validação de tipo e tamanho é aqui — chamada direta na API não passa pelo redimensionamento.
   */
  async updateAssetPhoto(userId: string, id: string, dto: UpdateAssetPhotoDto) {
    await this.getOwned(userId, id);

    if (dto.photo === null) {
      await this.financings.update(id, { photo: null });
      return this.findOne(userId, id);
    }

    const parsed = parseAssetPhoto(dto.photo);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);

    await this.financings.update(id, { photo: parsed.dataUrl });
    return this.findOne(userId, id);
  }

  /** Série completa de avaliações + o resumo da trajetória, pro gráfico de histórico de preço. */
  async assetValueHistory(userId: string, id: string) {
    await this.getOwned(userId, id);
    const valuations = await this.financings.listAssetValues(id);
    return { valuations, trend: summarizeAssetValueHistory(valuations) };
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
