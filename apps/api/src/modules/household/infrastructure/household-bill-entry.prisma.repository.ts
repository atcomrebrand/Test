import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateHouseholdBillEntryData,
  HouseholdBillEntryRepository,
  UpdateHouseholdBillEntryData,
} from "../domain/household-bill-entry.repository";

const INCLUDE = { bill: { include: { category: true } } };

@Injectable()
export class HouseholdBillEntryPrismaRepository extends HouseholdBillEntryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findByMonth(userId: string, referenceYear: number, referenceMonth: number) {
    return this.prisma.householdBillEntry.findMany({
      where: { userId, referenceYear, referenceMonth },
      include: INCLUDE,
      orderBy: [{ bill: { order: "asc" } }, { id: "asc" }],
    });
  }

  async findExistingBillIdsForMonth(userId: string, referenceYear: number, referenceMonth: number) {
    const rows = await this.prisma.householdBillEntry.findMany({
      where: { userId, referenceYear, referenceMonth },
      select: { billId: true },
    });
    return new Set(rows.map((r) => r.billId));
  }

  async createMany(entries: CreateHouseholdBillEntryData[]) {
    if (entries.length === 0) return;
    await this.prisma.householdBillEntry.createMany({
      data: entries.map((e) => ({
        userId: e.userId,
        billId: e.billId,
        referenceYear: e.referenceYear,
        referenceMonth: e.referenceMonth,
        dueDate: e.dueDate,
        amount: e.amount,
        status: e.status,
      })),
    });
  }

  findById(id: string) {
    return this.prisma.householdBillEntry.findUnique({ where: { id }, include: INCLUDE });
  }

  update(id: string, data: UpdateHouseholdBillEntryData) {
    return this.prisma.householdBillEntry.update({ where: { id }, data, include: INCLUDE });
  }

  countByBill(billId: string) {
    return this.prisma.householdBillEntry.count({ where: { billId } });
  }
}
