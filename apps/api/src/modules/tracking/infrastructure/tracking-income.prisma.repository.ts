import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTrackingIncomeData, TrackingIncomeRepository } from "../domain/tracking-income.repository";

@Injectable()
export class TrackingIncomePrismaRepository extends TrackingIncomeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.trackingIncome.findMany({
      where: { userId, deletedAt: null },
      orderBy: { date: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.trackingIncome.findUnique({ where: { id } });
  }

  create(data: CreateTrackingIncomeData) {
    return this.prisma.trackingIncome.create({
      data: {
        userId: data.userId,
        name: data.name,
        category: (data.category as any) ?? "OUTRO",
        amount: data.amount,
        date: data.date,
        notes: data.notes,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.trackingIncome.update({ where: { id }, data: data as any });
  }

  async softDelete(id: string) {
    await this.prisma.trackingIncome.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
