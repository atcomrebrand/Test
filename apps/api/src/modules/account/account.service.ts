import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wipes all financial data (cards, purchases, installments, payments, notifications,
   * custom categories) but keeps the login, preferences and default categories intact —
   * useful for restarting a trial/test run without losing the account itself.
   */
  async resetData(userId: string) {
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId } }),
      // Deleting purchases cascades installments, payments and their audit logs at the DB level.
      this.prisma.purchase.deleteMany({ where: { userId } }),
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.card.deleteMany({ where: { userId } }),
      this.prisma.category.deleteMany({ where: { userId, isDefault: false } }),
    ]);

    return { success: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Senha incorreta.");

    // All relations are FK onDelete: Cascade from User, so this removes everything.
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }
}
