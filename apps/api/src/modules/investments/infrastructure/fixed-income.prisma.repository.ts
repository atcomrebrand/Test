import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateFixedIncomeData, FixedIncomeRepository } from "../domain/fixed-income.repository";

@Injectable()
export class FixedIncomePrismaRepository extends FixedIncomeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.investmentFixedIncome.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ redeemedAt: "asc" }, { maturityDate: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.investmentFixedIncome.findUnique({ where: { id } });
  }

  async create(data: CreateFixedIncomeData) {
    return this.prisma.$transaction(async (tx) => {
      const fixedIncome = await tx.investmentFixedIncome.create({
        data: {
          userId: data.userId,
          institution: data.institution,
          type: data.type as any,
          principalAmount: data.principalAmount,
          contributedAmount: data.contributedAmount,
          applicationDate: data.applicationDate,
          maturityDate: data.maturityDate,
          liquidity: data.liquidity as any,
          indexer: data.indexer as any,
          fixedRatePercent: data.fixedRatePercent,
          cdiPercent: data.cdiPercent,
          notes: data.notes,
        },
      });

      await tx.investmentAuditLog.create({
        data: {
          userId: data.userId,
          entity: "InvestmentFixedIncome",
          entityId: fixedIncome.id,
          action: "APPLICATION",
          changes: { institution: data.institution, type: data.type, principalAmount: data.principalAmount },
        },
      });

      return fixedIncome;
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const fixedIncome = await tx.investmentFixedIncome.update({ where: { id }, data: data as any });
      await tx.investmentAuditLog.create({
        data: { userId: fixedIncome.userId, entity: "InvestmentFixedIncome", entityId: id, action: "UPDATE", changes: data as any },
      });
      return fixedIncome;
    });
  }

  async softDelete(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const fixedIncome = await tx.investmentFixedIncome.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.investmentAuditLog.create({
        data: { userId: fixedIncome.userId, entity: "InvestmentFixedIncome", entityId: id, action: "DELETE" },
      });
    });
  }

  async redeem(id: string, redeemedAt: Date, redeemedNetAmount: number) {
    return this.prisma.$transaction(async (tx) => {
      const fixedIncome = await tx.investmentFixedIncome.update({
        where: { id },
        data: { redeemedAt, redeemedNetAmount },
      });
      await tx.investmentAuditLog.create({
        data: {
          userId: fixedIncome.userId,
          entity: "InvestmentFixedIncome",
          entityId: id,
          action: "REDEMPTION",
          changes: { redeemedAt, redeemedNetAmount },
        },
      });
      return fixedIncome;
    });
  }

  async unredeem(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const fixedIncome = await tx.investmentFixedIncome.update({
        where: { id },
        data: { redeemedAt: null, redeemedNetAmount: null },
      });
      await tx.investmentAuditLog.create({
        data: { userId: fixedIncome.userId, entity: "InvestmentFixedIncome", entityId: id, action: "UNDO_REDEMPTION" },
      });
      return fixedIncome;
    });
  }

  async addIncome(data: { userId: string; fixedIncomeId: string; type: string; amount: number; paymentDate: Date; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.investmentIncome.create({
        data: {
          userId: data.userId,
          fixedIncomeId: data.fixedIncomeId,
          type: data.type as any,
          amount: data.amount,
          paymentDate: data.paymentDate,
          notes: data.notes,
        },
      });
      await tx.investmentAuditLog.create({
        data: {
          userId: data.userId,
          entity: "InvestmentIncome",
          entityId: income.id,
          action: "INTEREST",
          changes: { fixedIncomeId: data.fixedIncomeId, amount: data.amount },
        },
      });
      return income;
    });
  }

  listIncomes(fixedIncomeId: string) {
    return this.prisma.investmentIncome.findMany({ where: { fixedIncomeId }, orderBy: { paymentDate: "desc" } });
  }
}
