import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: string) {
    if (!query || query.trim().length === 0) {
      return { purchases: [], cards: [] };
    }
    const term = query.trim();
    const numeric = Number(term.replace(",", "."));
    const isNumeric = !Number.isNaN(numeric) && term.match(/^[\d.,]+$/);

    const purchases = await this.prisma.purchase.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { merchant: { contains: term, mode: "insensitive" } },
          { notes: { contains: term, mode: "insensitive" } },
          { tags: { has: term } },
          { category: { name: { contains: term, mode: "insensitive" } } },
          { card: { name: { contains: term, mode: "insensitive" } } },
          ...(isNumeric ? [{ totalAmount: { equals: numeric } }] : []),
        ],
      },
      include: { card: true, category: true },
      orderBy: { purchaseDate: "desc" },
      take: 20,
    });

    const cards = await this.prisma.card.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { bank: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 10,
    });

    return { purchases, cards };
  }
}
