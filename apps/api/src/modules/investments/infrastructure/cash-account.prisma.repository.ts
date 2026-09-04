import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CashAccountRepository, CreateCashAccountData } from "../domain/cash-account.repository";

@Injectable()
export class CashAccountPrismaRepository extends CashAccountRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.investmentCashAccount.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  }

  findById(id: string) {
    return this.prisma.investmentCashAccount.findUnique({ where: { id } });
  }

  async create(data: CreateCashAccountData) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.investmentCashAccount.create({
        data: { userId: data.userId, name: data.name, institution: data.institution, balance: data.balance, notes: data.notes },
      });
      await tx.investmentAuditLog.create({
        data: { userId: data.userId, entity: "InvestmentCashAccount", entityId: account.id, action: "CREATE", changes: { name: data.name, balance: data.balance } },
      });
      return account;
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.investmentCashAccount.update({ where: { id }, data: data as any });
      await tx.investmentAuditLog.create({
        data: { userId: account.userId, entity: "InvestmentCashAccount", entityId: id, action: "UPDATE", changes: data as any },
      });
      return account;
    });
  }

  async softDelete(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.investmentCashAccount.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.investmentAuditLog.create({ data: { userId: account.userId, entity: "InvestmentCashAccount", entityId: id, action: "DELETE" } });
    });
  }

  async sumBalancesByUser(userId: string) {
    const agg = await this.prisma.investmentCashAccount.aggregate({ where: { userId, deletedAt: null }, _sum: { balance: true } });
    return Number(agg._sum.balance ?? 0);
  }
}
