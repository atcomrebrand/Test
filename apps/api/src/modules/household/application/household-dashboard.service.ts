import { Injectable } from "@nestjs/common";
import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdCardsService } from "./household-cards.service";
import { HouseholdIncomesService } from "./household-incomes.service";

const UPCOMING_DAYS = 7;

@Injectable()
export class HouseholdDashboardService {
  constructor(
    private readonly bills: HouseholdBillsService,
    private readonly cards: HouseholdCardsService,
    private readonly incomes: HouseholdIncomesService,
  ) {}

  async month(userId: string, referenceYear: number, referenceMonth: number) {
    const [billEntries, cardEntries, incomeEntries] = await Promise.all([
      this.bills.findMonth(userId, referenceYear, referenceMonth),
      this.cards.findMonth(userId, referenceYear, referenceMonth),
      this.incomes.findMonth(userId, referenceYear, referenceMonth),
    ]);

    const totalIncome = incomeEntries.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalBills = billEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCards = cardEntries.reduce((sum, e) => sum + e.realAmount, 0);
    const totalCommitted = totalBills + totalCards;
    const totalReserved = billEntries.reduce((sum, e) => sum + Number(e.reservedAmount), 0);
    const totalMandatory = billEntries.filter((e) => e.bill.mandatory).reduce((sum, e) => sum + Number(e.amount), 0) + totalCards;
    const totalOptional = billEntries.filter((e) => !e.bill.mandatory).reduce((sum, e) => sum + Number(e.amount), 0);
    const billsPaidAmount = billEntries.reduce((sum, e) => sum + Number(e.paidAmount), 0);
    const cardsPaidAmount = cardEntries.reduce((sum, e) => sum + (e.paid ? e.realAmount : 0), 0);
    const totalPaid = billsPaidAmount + cardsPaidAmount;
    const totalPending = Math.max(0, totalCommitted - totalPaid);
    const freeBalance = totalIncome - totalCommitted;

    const billsCount = billEntries.length;
    const billsPaidCount = billEntries.filter((e) => e.status === "PAID").length;
    const billsLateCount = billEntries.filter((e) => e.status === "LATE").length;
    const billsPendingCount = billsCount - billsPaidCount - billsLateCount;

    const now = new Date();
    const upcomingLimit = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
    const upcomingDue = billEntries
      .filter((e) => e.status !== "PAID" && e.status !== "LATE" && e.dueDate >= now && e.dueDate <= upcomingLimit)
      .map((e) => ({ id: e.id, name: e.bill.name, dueDate: e.dueDate, amount: Number(e.amount) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const lateBills = billEntries
      .filter((e) => e.status === "LATE")
      .map((e) => ({ id: e.id, name: e.bill.name, dueDate: e.dueDate, amount: Number(e.amount) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const paidPct = billsCount > 0 ? Math.round((billsPaidCount / billsCount) * 1000) / 10 : 0;
    const reservedPct = totalBills > 0 ? Math.round((totalReserved / totalBills) * 1000) / 10 : 0;

    const categoryTotals = new Map<string, { name: string; color: string; amount: number }>();
    for (const entry of billEntries) {
      const key = entry.bill.category?.id ?? "sem-categoria";
      const name = entry.bill.category?.name ?? "Sem categoria";
      const color = entry.bill.category?.color ?? "#8B8B8B";
      const current = categoryTotals.get(key) ?? { name, color, amount: 0 };
      current.amount += Number(entry.amount);
      categoryTotals.set(key, current);
    }
    const billsByCategory = Array.from(categoryTotals.values()).sort((a, b) => b.amount - a.amount);

    const daysInMonth = new Date(referenceYear, referenceMonth, 0).getDate();
    const paymentEvolution = this.buildPaymentEvolution(billEntries, cardEntries, daysInMonth);

    return {
      referenceYear,
      referenceMonth,
      totalIncome,
      totalBills,
      totalCards,
      totalCommitted,
      totalReserved,
      totalMandatory,
      totalOptional,
      totalPaid,
      totalPending,
      freeBalance,
      billsCount,
      billsPaidCount,
      billsPendingCount,
      billsLateCount,
      upcomingDue,
      lateBills,
      paidPct,
      reservedPct,
      incomeVsExpenses: { income: totalIncome, expenses: totalCommitted },
      billsByCategory,
      paymentEvolution,
    };
  }

  /** Cumulative amount paid, day by day across the month, using each entry's paidAt — lets the
   *  Dashboard chart show how payment builds up as the month goes, not just the final total. */
  private buildPaymentEvolution(
    billEntries: Awaited<ReturnType<HouseholdBillsService["findMonth"]>>,
    cardEntries: Awaited<ReturnType<HouseholdCardsService["findMonth"]>>,
    daysInMonth: number,
  ) {
    const paidByDay = new Map<number, number>();
    for (const entry of billEntries) {
      if (entry.status === "PAID" && entry.paidAt) {
        const day = entry.paidAt.getDate();
        paidByDay.set(day, (paidByDay.get(day) ?? 0) + Number(entry.paidAmount));
      }
    }
    for (const entry of cardEntries) {
      if (entry.paid && entry.paidAt) {
        const day = entry.paidAt.getDate();
        paidByDay.set(day, (paidByDay.get(day) ?? 0) + entry.realAmount);
      }
    }

    let cumulative = 0;
    const evolution: { day: number; cumulativePaid: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      cumulative += paidByDay.get(day) ?? 0;
      evolution.push({ day, cumulativePaid: Math.round(cumulative * 100) / 100 });
    }
    return evolution;
  }
}
