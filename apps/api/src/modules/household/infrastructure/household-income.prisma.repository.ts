import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdIncomeData, HouseholdIncomeRepository } from "../domain/household-income.repository";

const INCLUDE = { category: true };

@Injectable()
export class HouseholdIncomePrismaRepository extends HouseholdIncomeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.householdIncome.findMany({ where: { userId }, include: INCLUDE, orderBy: { date: "desc" } });
  }

  findByMonth(userId: string, referenceYear: number, referenceMonth: number) {
    const from = new Date(referenceYear, referenceMonth - 1, 1, 0, 0, 0);
    const to = new Date(referenceYear, referenceMonth, 0, 23, 59, 59, 999);
    return this.prisma.householdIncome.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: INCLUDE,
      orderBy: { date: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.householdIncome.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateHouseholdIncomeData) {
    return this.prisma.householdIncome.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        date: data.date,
        description: data.description,
        amount: data.amount,
        isForeignCurrency: data.isForeignCurrency,
        grossAmountForeign: data.grossAmountForeign,
        exchangeRate: data.exchangeRate,
        notes: data.notes,
      },
      include: INCLUDE,
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.householdIncome.update({ where: { id }, data, include: INCLUDE });
  }

  async delete(id: string) {
    await this.prisma.householdIncome.delete({ where: { id } });
  }
}
