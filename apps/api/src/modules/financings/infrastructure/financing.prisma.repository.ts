import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateFinancingData, FinancingRepository } from "../domain/financing.repository";
import { GeneratedFixedInstallment } from "../domain/financing-installment-generator";

@Injectable()
export class FinancingPrismaRepository extends FinancingRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.financing.findMany({
      where: { userId },
      include: { installments: { orderBy: { number: "asc" } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });
  }

  findById(id: string) {
    return this.prisma.financing.findUnique({ where: { id } });
  }

  findByIdWithInstallments(id: string) {
    return this.prisma.financing.findUnique({
      where: { id },
      include: { installments: { orderBy: { number: "asc" } } },
    });
  }

  async createWithInstallments(data: CreateFinancingData, installments: GeneratedFixedInstallment[]) {
    return this.prisma.$transaction(async (tx) => {
      const financing = await tx.financing.create({
        data: {
          userId: data.userId,
          name: data.name,
          kind: data.kind as any,
          institution: data.institution,
          totalAmount: data.totalAmount,
          installmentAmount: data.installmentAmount,
          installmentsCount: data.installmentsCount,
          firstDueDate: data.firstDueDate,
          payoffAmount: data.payoffAmount,
          payoffQuotedAt: data.payoffQuotedAt,
          notes: data.notes,
        },
      });

      await tx.financingInstallment.createMany({
        data: installments.map((i) => ({
          userId: data.userId,
          financingId: financing.id,
          number: i.number,
          amount: i.amount,
          dueDate: i.dueDate,
          status: i.status,
          paidAt: i.paidAt,
          paidAmount: i.paidAmount,
        })),
      });

      return financing;
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.financing.update({ where: { id }, data: data as any });
  }

  async delete(id: string) {
    await this.prisma.financing.delete({ where: { id } });
  }

  async refreshLateStatuses(userId: string) {
    await this.prisma.financingInstallment.updateMany({
      where: { userId, status: "PENDING", dueDate: { lt: new Date() } },
      data: { status: "LATE" },
    });
  }

  findInstallmentById(id: string) {
    return this.prisma.financingInstallment.findUnique({ where: { id } });
  }

  async payInstallment(userId: string, id: string, paidAmount: number) {
    const installment = await this.prisma.financingInstallment.findUnique({ where: { id } });
    if (!installment) throw new NotFoundException("Parcela não encontrada.");

    return this.prisma.financingInstallment.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), paidAmount },
    });
  }

  async unpayInstallment(id: string) {
    const installment = await this.prisma.financingInstallment.findUniqueOrThrow({ where: { id } });
    return this.prisma.financingInstallment.update({
      where: { id },
      data: {
        status: installment.dueDate < new Date() ? "LATE" : "PENDING",
        paidAt: null,
        paidAmount: null,
      },
    });
  }

  updateInstallmentStatus(id: string, status: string) {
    return this.prisma.financingInstallment.update({ where: { id }, data: { status: status as any } });
  }

  async summary(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [activeCount, committedAgg, remainingAgg, paidAgg, nextInstallment] = await Promise.all([
      this.prisma.financing.count({ where: { userId, active: true } }),
      this.prisma.financingInstallment.aggregate({
        where: { userId, dueDate: { gte: monthStart, lt: monthEnd }, status: { not: "CANCELLED" } },
        _sum: { amount: true },
      }),
      this.prisma.financingInstallment.aggregate({
        where: { userId, status: { in: ["PENDING", "LATE"] } },
        _sum: { amount: true },
      }),
      this.prisma.financingInstallment.aggregate({
        where: { userId, status: "PAID" },
        _sum: { paidAmount: true },
      }),
      this.prisma.financingInstallment.findFirst({
        where: { userId, status: { in: ["PENDING", "LATE"] } },
        orderBy: { dueDate: "asc" },
        include: { financing: true },
      }),
    ]);

    return {
      totalActive: activeCount,
      committedThisMonth: Number(committedAgg._sum.amount ?? 0),
      totalRemaining: Number(remainingAgg._sum.amount ?? 0),
      totalPaid: Number(paidAgg._sum.paidAmount ?? 0),
      nextInstallment: nextInstallment
        ? {
            financingId: nextInstallment.financingId,
            financingName: nextInstallment.financing.name,
            dueDate: nextInstallment.dueDate,
            amount: Number(nextInstallment.amount),
          }
        : null,
    };
  }

  async addPayoffQuote(userId: string, financingId: string, amount: number, quotedAt: Date) {
    await this.prisma.financingPayoffQuote.create({ data: { userId, financingId, amount, quotedAt } });
  }

  async listPayoffQuotesSince(financingId: string, since: Date) {
    const quotes = await this.prisma.financingPayoffQuote.findMany({
      where: { financingId, quotedAt: { gte: since } },
      orderBy: { quotedAt: "asc" },
      select: { amount: true, quotedAt: true },
    });
    return quotes.map((q) => ({ amount: Number(q.amount), quotedAt: q.quotedAt }));
  }
}
