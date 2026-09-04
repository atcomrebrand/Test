import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateRechargeData, CrmResellerRepository, ResellerFilters } from "../domain/crm-reseller.repository";

const RESELLER_INCLUDE = {
  portfolios: { include: { portfolio: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.CrmResellerInclude;

@Injectable()
export class CrmResellerPrismaRepository extends CrmResellerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(userId: string, filters: ResellerFilters) {
    const rows = await this.prisma.crmReseller.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters.portfolioId || filters.status
          ? {
              portfolios: {
                some: {
                  ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
                  ...(filters.status ? { status: filters.status as never } : {}),
                },
              },
            }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { companyName: { contains: filters.search, mode: "insensitive" } },
                { phone: { contains: filters.search } },
                { whatsapp: { contains: filters.search } },
                { email: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: RESELLER_INCLUDE,
      orderBy: { name: "asc" },
    });

    // Filtrar por portfólio devolve o revendedor inteiro; recortar aqui evita mostrar o saldo do
    // Serviço B numa tela que o usuário abriu filtrada no A.
    if (!filters.portfolioId) return rows;
    return rows.map((r) => ({ ...r, portfolios: r.portfolios.filter((p) => p.portfolioId === filters.portfolioId) }));
  }

  findById(userId: string, id: string) {
    return this.prisma.crmReseller.findFirst({ where: { id, userId }, include: RESELLER_INCLUDE });
  }

  create(userId: string, data: Record<string, unknown>, tagIds?: string[]) {
    return this.prisma.crmReseller.create({
      data: {
        userId,
        ...data,
        ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      } as Prisma.CrmResellerUncheckedCreateInput,
      include: RESELLER_INCLUDE,
    });
  }

  async update(id: string, data: Record<string, unknown>, tagIds?: string[]) {
    if (tagIds) {
      await this.prisma.crmResellerTag.deleteMany({ where: { resellerId: id } });
      if (tagIds.length) {
        await this.prisma.crmResellerTag.createMany({ data: tagIds.map((tagId) => ({ resellerId: id, tagId })) });
      }
    }
    return this.prisma.crmReseller.update({
      where: { id },
      data: data as Prisma.CrmResellerUpdateInput,
      include: RESELLER_INCLUDE,
    });
  }

  async softDelete(id: string) {
    await this.prisma.crmReseller.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -------------------------------------------------------------------------
  // Vínculo revendedor × serviço
  // -------------------------------------------------------------------------

  findLink(userId: string, id: string) {
    return this.prisma.crmResellerPortfolio.findFirst({ where: { id, userId }, include: { portfolio: true } });
  }

  findLinkByPair(userId: string, resellerId: string, portfolioId: string) {
    return this.prisma.crmResellerPortfolio.findFirst({
      where: { userId, resellerId, portfolioId },
      include: { portfolio: true },
    });
  }

  createLink(userId: string, data: Record<string, unknown>) {
    return this.prisma.crmResellerPortfolio.create({
      data: { userId, ...data } as Prisma.CrmResellerPortfolioUncheckedCreateInput,
      include: { portfolio: true },
    });
  }

  updateLink(id: string, data: Record<string, unknown>) {
    return this.prisma.crmResellerPortfolio.update({
      where: { id },
      data: data as Prisma.CrmResellerPortfolioUpdateInput,
      include: { portfolio: true },
    });
  }

  // -------------------------------------------------------------------------
  // Recargas e créditos
  // -------------------------------------------------------------------------

  async createRecharge(data: CreateRechargeData) {
    return this.prisma.$transaction(async (tx) => {
      const recharge = await tx.crmRecharge.create({
        data: {
          userId: data.userId,
          resellerPortfolioId: data.resellerPortfolioId,
          portfolioId: data.portfolioId,
          date: data.date,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: data.totalAmount,
          paymentMethodId: data.paymentMethodId,
          paymentMethodName: data.paymentMethodName,
          feePercent: data.feePercent,
          feeFixed: data.feeFixed,
          feeAmount: data.feeAmount,
          netAmount: data.netAmount,
          notes: data.notes,
        },
      });

      const movement = await tx.crmCreditMovement.create({
        data: {
          userId: data.userId,
          resellerPortfolioId: data.resellerPortfolioId,
          kind: "RECHARGE",
          quantity: data.quantity,
          rechargeId: recharge.id,
          note: `Recarga de ${data.quantity} créditos`,
        },
      });

      return { recharge, movement };
    });
  }

  listRecharges(userId: string, resellerPortfolioId: string) {
    return this.prisma.crmRecharge.findMany({
      where: { userId, resellerPortfolioId },
      orderBy: { date: "desc" },
    });
  }

  addMovement(userId: string, resellerPortfolioId: string, kind: string, quantity: number, note?: string | null) {
    return this.prisma.crmCreditMovement.create({
      data: { userId, resellerPortfolioId, kind: kind as never, quantity, note: note ?? null },
    });
  }

  listMovements(userId: string, resellerPortfolioId: string) {
    return this.prisma.crmCreditMovement.findMany({
      where: { userId, resellerPortfolioId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  /**
   * Saldo e agregados de vários vínculos numa consulta só. Sem isso a lista de revendedores faria
   * um SELECT de movimentações por linha — o N+1 clássico, e aqui em cima de uma tabela que só
   * cresce.
   */
  async creditPositions(userId: string, resellerPortfolioIds: string[]) {
    if (resellerPortfolioIds.length === 0) return [];

    const [movements, positives, negatives, recharges] = await Promise.all([
      this.prisma.crmCreditMovement.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: resellerPortfolioIds } },
        _sum: { quantity: true },
      }),
      this.prisma.crmCreditMovement.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: resellerPortfolioIds }, quantity: { gte: 0 } },
        _sum: { quantity: true },
      }),
      this.prisma.crmCreditMovement.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: resellerPortfolioIds }, quantity: { lt: 0 } },
        _sum: { quantity: true },
      }),
      this.prisma.crmRecharge.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: resellerPortfolioIds } },
        _sum: { totalAmount: true },
        _count: true,
        _max: { date: true },
      }),
    ]);

    const balance = new Map(movements.map((m) => [m.resellerPortfolioId, m._sum.quantity ?? 0]));
    const purchased = new Map(positives.map((m) => [m.resellerPortfolioId, m._sum.quantity ?? 0]));
    const used = new Map(negatives.map((m) => [m.resellerPortfolioId, -(m._sum.quantity ?? 0)]));
    const rech = new Map(recharges.map((r) => [r.resellerPortfolioId, r]));

    return resellerPortfolioIds.map((id) => {
      const r = rech.get(id);
      return {
        resellerPortfolioId: id,
        balance: balance.get(id) ?? 0,
        purchased: purchased.get(id) ?? 0,
        used: used.get(id) ?? 0,
        totalRecharges: r?._count ?? 0,
        totalSpent: Number(r?._sum.totalAmount ?? 0),
        lastRechargeAt: r?._max.date ?? null,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Históricos de preço e de estimativa
  // -------------------------------------------------------------------------

  recordPriceChange(userId: string, resellerPortfolioId: string, previousPrice: number, newPrice: number) {
    return this.prisma.crmCreditPriceChange.create({
      data: { userId, resellerPortfolioId, previousPrice, newPrice },
    });
  }

  listPriceChanges(userId: string, resellerPortfolioId: string) {
    return this.prisma.crmCreditPriceChange.findMany({
      where: { userId, resellerPortfolioId },
      orderBy: { changedAt: "desc" },
    });
  }

  recordApproxChange(userId: string, resellerPortfolioId: string, previousValue: number, newValue: number) {
    return this.prisma.crmApproxClientsChange.create({
      data: { userId, resellerPortfolioId, previousValue, newValue },
    });
  }

  listApproxChanges(userId: string, resellerPortfolioId: string) {
    return this.prisma.crmApproxClientsChange.findMany({
      where: { userId, resellerPortfolioId },
      orderBy: { changedAt: "desc" },
    });
  }
}
