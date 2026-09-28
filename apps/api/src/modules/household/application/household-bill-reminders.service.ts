import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatBRL(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Daily "conta vencendo" reminders — a bill entry not yet PAID or SKIPPED, due today or tomorrow,
 * gets one push. Same "one per user/type/title/day" dedup as every other notification, so it's
 * safe even though the sweep re-scans the same entries every day until they're resolved.
 */
@Injectable()
export class HouseholdBillRemindersService {
  private readonly logger = new Logger(HouseholdBillRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async tick() {
    await this.checkDueReminders().catch((err) => this.logger.warn(`Falha ao checar lembretes de vencimento: ${(err as Error).message}`));
  }

  async checkDueReminders(now: Date = new Date()) {
    const windowStart = startOfDay(now);
    const windowEnd = endOfDay(addDays(now, 1));

    const dueEntries = await this.prisma.householdBillEntry.findMany({
      where: {
        status: { notIn: ["PAID", "SKIPPED"] },
        dueDate: { gte: windowStart, lte: windowEnd },
      },
      include: { bill: true },
    });

    const todayEnd = endOfDay(now);

    for (const entry of dueEntries) {
      try {
        const isToday = entry.dueDate <= todayEnd;
        const label = isToday ? "vence hoje" : "vence amanhã";
        await this.notifications.notifyIfNew(
          entry.userId,
          "HOUSEHOLD_BILL_DUE",
          `Conta ${label}: ${entry.bill.name}`,
          `${entry.bill.name} ${label} — ${formatBRL(Number(entry.amount))}.`,
        );
      } catch (err) {
        this.logger.warn(`Falha ao notificar vencimento da conta ${entry.id}: ${(err as Error).message}`);
      }
    }
  }
}
