import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdBillData, HouseholdBillRepository } from "../domain/household-bill.repository";

const INCLUDE = { category: true };

@Injectable()
export class HouseholdBillPrismaRepository extends HouseholdBillRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.householdBill.findMany({ where: { userId }, include: INCLUDE, orderBy: [{ order: "asc" }, { id: "asc" }] });
  }

  findActiveByUser(userId: string) {
    return this.prisma.householdBill.findMany({
      where: { userId, active: true },
      include: INCLUDE,
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.householdBill.findUnique({ where: { id }, include: INCLUDE });
  }

  async create(data: CreateHouseholdBillData) {
    const maxOrder = await this.prisma.householdBill.aggregate({ where: { userId: data.userId }, _max: { order: true } });
    return this.prisma.householdBill.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        name: data.name,
        dueDay: data.dueDay,
        defaultAmount: data.defaultAmount,
        allowAmountChange: data.allowAmountChange ?? true,
        mandatory: data.mandatory ?? true,
        notes: data.notes,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: INCLUDE,
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.householdBill.update({ where: { id }, data, include: INCLUDE });
  }

  async delete(id: string) {
    await this.prisma.householdBill.delete({ where: { id } });
  }

  async reorder(userId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.householdBill.updateMany({ where: { id, userId }, data: { order: index } })),
    );
  }
}
