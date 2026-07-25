import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateHouseholdCardEntryData,
  HouseholdCardEntryRepository,
  UpdateHouseholdCardEntryData,
} from "../domain/household-card-entry.repository";

const INCLUDE = { card: true };

@Injectable()
export class HouseholdCardEntryPrismaRepository extends HouseholdCardEntryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findByMonth(userId: string, referenceYear: number, referenceMonth: number) {
    return this.prisma.householdCardEntry.findMany({
      where: { userId, referenceYear, referenceMonth },
      include: INCLUDE,
      orderBy: [{ card: { order: "asc" } }, { id: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.householdCardEntry.findUnique({ where: { id }, include: INCLUDE });
  }

  findByCardAndMonth(cardId: string, referenceYear: number, referenceMonth: number) {
    return this.prisma.householdCardEntry.findUnique({
      where: { cardId_referenceYear_referenceMonth: { cardId, referenceYear, referenceMonth } },
      include: INCLUDE,
    });
  }

  async findExistingCardIdsForMonth(userId: string, referenceYear: number, referenceMonth: number) {
    const rows = await this.prisma.householdCardEntry.findMany({
      where: { userId, referenceYear, referenceMonth },
      select: { cardId: true },
    });
    return new Set(rows.map((r) => r.cardId));
  }

  async createMany(entries: CreateHouseholdCardEntryData[]) {
    if (entries.length === 0) return;
    await this.prisma.householdCardEntry.createMany({
      data: entries.map((e) => ({
        userId: e.userId,
        cardId: e.cardId,
        referenceYear: e.referenceYear,
        referenceMonth: e.referenceMonth,
        totalInvoice: e.totalInvoice,
        provisioned: e.provisioned ?? 0,
      })),
    });
  }

  update(id: string, data: UpdateHouseholdCardEntryData) {
    return this.prisma.householdCardEntry.update({ where: { id }, data, include: INCLUDE });
  }
}
