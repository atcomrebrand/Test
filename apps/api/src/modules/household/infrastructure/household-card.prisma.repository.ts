import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdCardData, HouseholdCardRepository } from "../domain/household-card.repository";

@Injectable()
export class HouseholdCardPrismaRepository extends HouseholdCardRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.householdCard.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  }

  findActiveByUser(userId: string) {
    return this.prisma.householdCard.findMany({ where: { userId, active: true }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  }

  findById(id: string) {
    return this.prisma.householdCard.findUnique({ where: { id } });
  }

  async create(data: CreateHouseholdCardData) {
    const maxOrder = await this.prisma.householdCard.aggregate({ where: { userId: data.userId }, _max: { order: true } });
    return this.prisma.householdCard.create({
      data: {
        userId: data.userId,
        name: data.name,
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        color: data.color,
        icon: data.icon,
        linkedCardId: data.linkedCardId,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.householdCard.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.householdCard.delete({ where: { id } });
  }

  async reorder(userId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.householdCard.updateMany({ where: { id, userId }, data: { order: index } })),
    );
  }
}
