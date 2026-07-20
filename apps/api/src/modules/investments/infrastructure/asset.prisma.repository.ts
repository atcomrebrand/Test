import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AssetRepository, CreateAssetData, CreateTransactionData } from "../domain/asset.repository";

@Injectable()
export class AssetPrismaRepository extends AssetRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string, assetClass?: string) {
    return this.prisma.investmentAsset.findMany({
      where: { userId, deletedAt: null, ...(assetClass ? { class: assetClass as any } : {}) },
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    });
  }

  findById(id: string) {
    return this.prisma.investmentAsset.findUnique({ where: { id } });
  }

  findByUserAndTicker(userId: string, assetClass: string, ticker: string) {
    return this.prisma.investmentAsset.findFirst({
      where: { userId, class: assetClass as any, ticker, deletedAt: null },
    });
  }

  findByIdWithTransactions(id: string) {
    return this.prisma.investmentAsset.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { transactionDate: "asc" } },
        incomes: { orderBy: { paymentDate: "desc" } },
      },
    });
  }

  async create(data: CreateAssetData) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.investmentAsset.create({
        data: {
          userId: data.userId,
          class: data.class as any,
          ticker: data.ticker,
          name: data.name,
          broker: data.broker,
          wallet: data.wallet,
          network: data.network,
          notes: data.notes,
          stakingApyPercent: data.stakingApyPercent,
        },
      });
      await tx.investmentAuditLog.create({
        data: { userId: data.userId, entity: "InvestmentAsset", entityId: asset.id, action: "CREATE", changes: { class: data.class, ticker: data.ticker } },
      });
      return asset;
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.investmentAsset.update({ where: { id }, data: data as any });
      await tx.investmentAuditLog.create({
        data: { userId: asset.userId, entity: "InvestmentAsset", entityId: id, action: "UPDATE", changes: data as any },
      });
      return asset;
    });
  }

  async softDelete(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const asset = await tx.investmentAsset.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.investmentAuditLog.create({
        data: { userId: asset.userId, entity: "InvestmentAsset", entityId: id, action: "DELETE" },
      });
    });
  }

  async addTransaction(data: CreateTransactionData) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.investmentTransaction.create({
        data: {
          userId: data.userId,
          assetId: data.assetId,
          type: data.type as any,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          fees: data.fees,
          transactionDate: data.transactionDate,
          notes: data.notes,
        },
      });
      await tx.investmentAuditLog.create({
        data: {
          userId: data.userId,
          entity: "InvestmentTransaction",
          entityId: transaction.id,
          action: data.type,
          changes: { assetId: data.assetId, quantity: data.quantity, unitPrice: data.unitPrice },
        },
      });
      return transaction;
    });
  }

  listTransactions(assetId: string) {
    return this.prisma.investmentTransaction.findMany({ where: { assetId }, orderBy: { transactionDate: "asc" } });
  }

  async addIncome(data: { userId: string; assetId: string; type: string; amount: number; paymentDate: Date; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.investmentIncome.create({
        data: {
          userId: data.userId,
          assetId: data.assetId,
          type: data.type as any,
          amount: data.amount,
          paymentDate: data.paymentDate,
          notes: data.notes,
        },
      });
      await tx.investmentAuditLog.create({
        data: { userId: data.userId, entity: "InvestmentIncome", entityId: income.id, action: "DIVIDEND", changes: { assetId: data.assetId, amount: data.amount } },
      });
      return income;
    });
  }

  listIncomes(assetId: string) {
    return this.prisma.investmentIncome.findMany({ where: { assetId }, orderBy: { paymentDate: "desc" } });
  }

  async sumIncomesByUser(userId: string, since?: Date) {
    const agg = await this.prisma.investmentIncome.aggregate({
      where: { userId, assetId: { not: null }, ...(since ? { paymentDate: { gte: since } } : {}) },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  listAllTransactionsByUser(userId: string) {
    return this.prisma.investmentTransaction.findMany({
      where: { userId },
      include: { asset: { select: { ticker: true, class: true } } },
    });
  }

  listAllIncomesByUser(userId: string) {
    return this.prisma.investmentIncome.findMany({
      where: { userId, assetId: { not: null } },
      include: { asset: { select: { ticker: true, class: true } } },
    });
  }
}
