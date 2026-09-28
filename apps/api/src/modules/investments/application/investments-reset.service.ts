import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Wipes every investment record for the user — assets (which cascades their transactions and
 * incomes at the DB level), fixed-income applications (which cascades their incomes too),
 * contributions, cash accounts, and the audit log. Mirrors AccountService.resetData's role for
 * the credit-card side, but scoped to the investments module and reachable from a button inside
 * "Investimentos" itself rather than the account-wide Settings danger zone — a quick way to
 * restart a test portfolio without touching login/preferences. InvestmentPriceCache isn't
 * user-scoped (shared quote cache keyed by symbol+class) so there's nothing to remove there.
 */
@Injectable()
export class InvestmentsResetService {
  constructor(private readonly prisma: PrismaService) {}

  async reset(userId: string) {
    await this.prisma.$transaction([
      this.prisma.investmentAsset.deleteMany({ where: { userId } }),
      this.prisma.investmentFixedIncome.deleteMany({ where: { userId } }),
      this.prisma.investmentContribution.deleteMany({ where: { userId } }),
      this.prisma.investmentCashAccount.deleteMany({ where: { userId } }),
      this.prisma.investmentAuditLog.deleteMany({ where: { userId } }),
    ]);

    return { success: true };
  }
}
