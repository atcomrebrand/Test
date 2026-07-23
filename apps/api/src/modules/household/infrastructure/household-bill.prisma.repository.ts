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
    return this.prisma.householdBill.findMany({ where: { userId }, include: INCLUDE, orderBy: { name: "asc" } });
  }

  findActiveByUser(userId: string) {
    return this.prisma.householdBill.findMany({ where: { userId, active: true }, include: INCLUDE, orderBy: { name: "asc" } });
  }

  findById(id: string) {
    return this.prisma.householdBill.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateHouseholdBillData) {
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

  countEntries(billId: string) {
    return this.prisma.householdBillEntry.count({ where: { billId } });
  }
}
