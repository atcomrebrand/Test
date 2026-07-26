import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InstallmentQueryDto, PayInstallmentDto, UpdateInstallmentStatusDto } from "./dto/installment.dto";

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Card installments settle themselves — the card issuer auto-debits the invoice, so once the
   * due date has passed there's nothing left for the user to confirm. Idempotently flips overdue
   * PENDING (and any pre-existing LATE, from before this behavior) installments to PAID, with a
   * matching Payment row, opportunistically on read. Cheap enough to run per-request.
   */
  async autoSettleOverdueInstallments(userId: string) {
    const overdue = await this.prisma.installment.findMany({
      where: { userId, status: { in: ["PENDING", "LATE"] }, dueDate: { lt: new Date() } },
      select: { id: true, amount: true, dueDate: true },
    });
    if (overdue.length === 0) return;

    await this.prisma.$transaction(
      overdue.flatMap((i) => [
        this.prisma.installment.update({ where: { id: i.id }, data: { status: "PAID" } }),
        this.prisma.payment.upsert({
          where: { installmentId: i.id },
          create: { userId, installmentId: i.id, amountPaid: i.amount, paidAt: i.dueDate },
          update: {},
        }),
      ]),
    );
  }

  async findAll(userId: string, query: InstallmentQueryDto) {
    await this.autoSettleOverdueInstallments(userId);

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
    // A compra excluída (lixeira) some da lista de Compras, mas suas parcelas continuam no banco —
    // sem esse filtro elas voltavam a aparecer aqui como se a compra ainda existisse.
    where.purchase = {
      deletedAt: null,
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

  /**
   * Reverts an auto-settled (or manually-paid) installment back to PENDING. Note this is a
   * momentary override for a past-due installment: the next opportunistic sweep will settle it
   * back to PAID again, since auto-settlement doesn't distinguish "never touched" from "undone".
   */
  async unpay(userId: string, id: string) {
    const installment = await this.getOwned(userId, id);
    if (installment.status !== "PAID") throw new BadRequestException("Parcela não está paga.");

    await this.prisma.$transaction([
      this.prisma.installment.update({ where: { id }, data: { status: "PENDING" } }),
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

  /** Sum of Installment.amount per cardId for a given competência (referenceYear/referenceMonth),
   *  excluding CANCELLED installments and installments whose purchase is in the lixeira (soft
   *  deleted) — same exclusion rule findAll() applies. Read-only: never touches this module's own
   *  tables. Used by the Household module to compute a "fatura presumida" for a linked card. */
  async getMonthlyTotalsForCards(userId: string, cardIds: string[], year: number, month: number): Promise<Map<string, number>> {
    if (cardIds.length === 0) return new Map();
    const grouped = await this.prisma.installment.groupBy({
      by: ["cardId"],
      where: {
        userId,
        cardId: { in: cardIds },
        referenceYear: year,
        referenceMonth: month,
        status: { not: "CANCELLED" },
        purchase: { deletedAt: null },
      },
      _sum: { amount: true },
    });
    return new Map(grouped.map((g) => [g.cardId, Number(g._sum.amount ?? 0)]));
  }

  private async getOwned(userId: string, id: string) {
    const installment = await this.prisma.installment.findUnique({ where: { id } });
    if (!installment) throw new NotFoundException("Parcela não encontrada.");
    if (installment.userId !== userId) throw new ForbiddenException();
    return installment;
  }
}
