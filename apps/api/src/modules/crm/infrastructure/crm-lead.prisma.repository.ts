import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CrmLeadRepository, LEAD_STAGES, LeadFilters, CrmLeadStage } from "../domain/crm-lead.repository";

const LEAD_INCLUDE = {
  portfolio: true,
  origin: true,
  tags: { include: { tag: true } },
} satisfies Prisma.CrmLeadInclude;

@Injectable()
export class CrmLeadPrismaRepository extends CrmLeadRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  list(userId: string, filters: LeadFilters) {
    return this.prisma.crmLead.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.originId ? { originId: filters.originId } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { phone: { contains: filters.search } },
                { whatsapp: { contains: filters.search } },
              ],
            }
          : {}),
      },
      include: LEAD_INCLUDE,
      orderBy: [{ nextContactAt: "asc" }, { createdAt: "desc" }],
    });
  }

  findById(userId: string, id: string) {
    return this.prisma.crmLead.findFirst({ where: { id, userId }, include: LEAD_INCLUDE });
  }

  create(userId: string, data: Record<string, unknown>, tagIds?: string[]) {
    return this.prisma.crmLead.create({
      data: {
        userId,
        ...data,
        ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      } as Prisma.CrmLeadUncheckedCreateInput,
      include: LEAD_INCLUDE,
    });
  }

  async update(id: string, data: Record<string, unknown>, tagIds?: string[]) {
    if (tagIds) {
      await this.prisma.crmLeadTag.deleteMany({ where: { leadId: id } });
      if (tagIds.length) {
        await this.prisma.crmLeadTag.createMany({ data: tagIds.map((tagId) => ({ leadId: id, tagId })) });
      }
    }
    return this.prisma.crmLead.update({
      where: { id },
      data: data as Prisma.CrmLeadUpdateInput,
      include: LEAD_INCLUDE,
    });
  }

  async softDelete(id: string) {
    await this.prisma.crmLead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Conversão por origem (§22, §23). Feito com groupBy: contar em JS exigiria trazer todo lead da
   * base, e essa consulta alimenta o dashboard, que abre a cada visita.
   */
  async conversionStats(userId: string, portfolioId?: string) {
    const where: Prisma.CrmLeadWhereInput = {
      userId,
      deletedAt: null,
      ...(portfolioId ? { portfolioId } : {}),
    };

    const [byStageRaw, byOriginRaw, byOriginConvertedRaw, origins, total, converted, lost, revenue] = await Promise.all([
      this.prisma.crmLead.groupBy({ by: ["stage"], where, _count: true }),
      this.prisma.crmLead.groupBy({ by: ["originId"], where, _count: true }),
      this.prisma.crmLead.groupBy({ by: ["originId"], where: { ...where, stage: "CONVERTED" }, _count: true }),
      this.prisma.crmOrigin.findMany({ where: { userId } }),
      this.prisma.crmLead.count({ where }),
      this.prisma.crmLead.count({ where: { ...where, stage: "CONVERTED" } }),
      this.prisma.crmLead.count({ where: { ...where, stage: "LOST" } }),
      // Receita dos convertidos: os pagamentos dos clientes que nasceram de um lead.
      this.prisma.crmPayment.aggregate({
        where: {
          userId,
          reversedAt: null,
          ...(portfolioId ? { portfolioId } : {}),
          customer: { convertedLead: { is: { deletedAt: null } } },
        },
        _sum: { grossAmount: true },
      }),
    ]);

    const convertedByOrigin = new Map(byOriginConvertedRaw.map((r) => [r.originId, r._count]));
    const originName = new Map(origins.map((o) => [o.id, o.name]));

    const byOrigin = byOriginRaw.map((r) => {
      const conv = convertedByOrigin.get(r.originId) ?? 0;
      return {
        originId: r.originId,
        originName: r.originId ? (originName.get(r.originId) ?? "—") : "Sem origem",
        total: r._count,
        converted: conv,
        rate: r._count > 0 ? Math.round((conv / r._count) * 10000) / 100 : null,
      };
    });

    const stageCount = new Map(byStageRaw.map((r) => [r.stage as CrmLeadStage, r._count]));

    return {
      total,
      converted,
      lost,
      conversionRate: total > 0 ? Math.round((converted / total) * 10000) / 100 : null,
      convertedRevenue: Number(revenue._sum.grossAmount ?? 0),
      byOrigin: byOrigin.sort((a, b) => b.total - a.total),
      byStage: LEAD_STAGES.map((stage) => ({ stage, count: stageCount.get(stage) ?? 0 })),
    };
  }
}
