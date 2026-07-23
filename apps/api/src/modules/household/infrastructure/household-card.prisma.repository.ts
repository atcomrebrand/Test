import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdCardData, HouseholdCardRepository } from "../domain/household-card.repository";

@Injectable()
export class HouseholdCardPrismaRepository extends HouseholdCardRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.householdCard.findMany({ where: { userId }, orderBy: { name: "asc" } });
  }

  findActiveByUser(userId: string) {
    return this.prisma.householdCard.findMany({ where: { userId, active: true }, orderBy: { name: "asc" } });
  }

  findById(id: string) {
    return this.prisma.householdCard.findUnique({ where: { id } });
  }

  create(data: CreateHouseholdCardData) {
    return this.prisma.householdCard.create({
      data: {
        userId: data.userId,
        name: data.name,
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        color: data.color,
        icon: data.icon,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.householdCard.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.householdCard.delete({ where: { id } });
  }

  countEntries(cardId: string) {
    return this.prisma.householdCardEntry.count({ where: { cardId } });
  }
}
