import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CardRepository, CreateCardData, UpdateCardData } from "../domain/card.repository";

@Injectable()
export class CardPrismaRepository extends CardRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.card.findMany({
      where: { userId },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.card.findUnique({ where: { id } });
  }

  create(data: CreateCardData) {
    return this.prisma.card.create({ data });
  }

  update(id: string, data: UpdateCardData) {
    return this.prisma.card.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.card.delete({ where: { id } });
  }

  countPurchases(id: string) {
    return this.prisma.purchase.count({ where: { cardId: id, deletedAt: null } });
  }

  async sumSpentByCard(id: string) {
    const result = await this.prisma.installment.aggregate({
      where: { cardId: id, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
