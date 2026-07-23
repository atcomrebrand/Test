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
      orderBy: { card: { name: "asc" } },
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

  create(data: CreateHouseholdCardEntryData) {
    return this.prisma.householdCardEntry.create({
      data: {
        userId: data.userId,
        cardId: data.cardId,
        referenceYear: data.referenceYear,
        referenceMonth: data.referenceMonth,
        totalInvoice: data.totalInvoice,
        provisioned: data.provisioned ?? 0,
        notes: data.notes,
      },
      include: INCLUDE,
    });
  }

  update(id: string, data: UpdateHouseholdCardEntryData) {
    return this.prisma.householdCardEntry.update({ where: { id }, data, include: INCLUDE });
  }
}
