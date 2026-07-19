import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InstallmentQueryDto, PayInstallmentDto, UpdateInstallmentStatusDto } from "./dto/installment.dto";

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently promotes overdue PENDING installments to LATE. Cheap enough to run per-request. */
  async refreshLateStatuses(userId: string) {
    await this.prisma.installment.updateMany({
      where: { userId, status: "PENDING", dueDate: { lt: new Date() } },
      data: { status: "LATE" },
    });
  }

  async findAll(userId: string, query: InstallmentQueryDto) {
    await this.refreshLateStatuses(userId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.InstallmentWhereInput = { userId };
    if (query.cardId) where.cardId = query.cardId;
    if (query.status) where.status = query.status;
    if (query.year) where.referenceYear = query.year;
    if (query.month) where.referenceMonth = query.month;
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {
        ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
        ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
      };
    }
    if (query.categoryId || query.search) {
      where.purchase = {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { merchant: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.installment.findMany({
        where,
        include: { purchase: { include: { category: true } }, card: true, payment: true },
        orderBy: [{ referenceYear: "asc" }, { referenceMonth: "asc" }, { dueDate: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.installment.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) } };
  }

  async pay(userId: string, id: string, dto: PayInstallmentDto) {
    const installment = await this.getOwned(userId, id);
    if (installment.status === "PAID") throw new BadRequestException("Parcela já está paga.");
    if (installment.status === "CANCELLED") throw new BadRequestException("Parcela cancelada não pode ser paga.");

    const amountPaid = dto.amountPaid ?? Number(installment.amount);

    await this.prisma.$transaction([
      this.prisma.installment.update({ where: { id }, data: { status: "PAID" } }),
      this.prisma.payment.upsert({
        where: { installmentId: id },
        create: { userId, installmentId: id, amountPaid, method: dto.method },
        update: { amountPaid, method: dto.method, paidAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          purchaseId: installment.purchaseId,
          entity: "Installment",
          entityId: id,
          action: "PAY",
          changes: { amountPaid } as any,
        },
      }),
    ]);

    return this.prisma.installment.findUnique({ where: { id }, include: { payment: true } });
  }

  async unpay(userId: string, id: string) {
    const installment = await this.getOwned(userId, id);
    if (installment.status !== "PAID") throw new BadRequestException("Parcela não está paga.");

    await this.prisma.$transaction([
      this.prisma.installment.update({
        where: { id },
        data: { status: installment.dueDate < new Date() ? "LATE" : "PENDING" },
      }),
      this.prisma.payment.deleteMany({ where: { installmentId: id } }),
    ]);

    return this.prisma.installment.findUnique({ where: { id } });
  }

  async updateStatus(userId: string, id: string, dto: UpdateInstallmentStatusDto) {
    const installment = await this.getOwned(userId, id);
    if (installment.status === "PAID") {
      throw new BadRequestException("Use a rota de pagamento para reverter uma parcela paga.");
    }

    await this.prisma.installment.update({ where: { id }, data: { status: dto.status } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        purchaseId: installment.purchaseId,
        entity: "Installment",
        entityId: id,
        action: `STATUS_${dto.status}`,
      },
    });

    return this.prisma.installment.findUnique({ where: { id } });
  }

  private async getOwned(userId: string, id: string) {
    const installment = await this.prisma.installment.findUnique({ where: { id } });
    if (!installment) throw new NotFoundException("Parcela não encontrada.");
    if (installment.userId !== userId) throw new ForbiddenException();
    return installment;
  }
}
