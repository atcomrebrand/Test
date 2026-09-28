import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Checks, after every bill/card entry write, whether the whole competência is now fully resolved
 * (every bill PAID or SKIPPED, every card invoice paid) and fires a one-time celebration push.
 * Queries Prisma directly instead of going through HouseholdBillsService/HouseholdCardsService —
 * both of those call back into this service, so depending on them here would be circular.
 */
@Injectable()
export class HouseholdMonthCompletionService {
  private readonly logger = new Logger(HouseholdMonthCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async checkAndNotify(userId: string, referenceYear: number, referenceMonth: number) {
    try {
      const [bills, cards] = await Promise.all([
        this.prisma.householdBillEntry.findMany({ where: { userId, referenceYear, referenceMonth }, select: { status: true } }),
        this.prisma.householdCardEntry.findMany({ where: { userId, referenceYear, referenceMonth }, select: { paid: true } }),
      ]);

      if (bills.length === 0 && cards.length === 0) return;

      const allBillsResolved = bills.every((b) => b.status === "PAID" || b.status === "SKIPPED");
      const allCardsPaid = cards.every((c) => c.paid);
      if (!allBillsResolved || !allCardsPaid) return;

      const monthLabel = MONTH_NAMES[referenceMonth - 1];
      await this.notifications.notifyIfNew(
        userId,
        "HOUSEHOLD_MONTH_FULLY_PAID",
        `${capitalize(monthLabel)} 100% pago!`,
        "Mas um mês com tudo pago — puxe a cadeira e descanse um pouco.",
      );
    } catch (err) {
      this.logger.warn(`Falha ao checar conclusão do mês ${referenceMonth}/${referenceYear} do usuário ${userId}: ${(err as Error).message}`);
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
