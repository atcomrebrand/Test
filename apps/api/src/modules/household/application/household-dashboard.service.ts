import { Injectable } from "@nestjs/common";
import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdCardsService } from "./household-cards.service";
import { HouseholdIncomesService } from "./household-incomes.service";
import { HouseholdPresumedSalaryService } from "./household-presumed-salary.service";

const UPCOMING_DAYS = 7;

function previousMonthOf(referenceYear: number, referenceMonth: number) {
  return referenceMonth === 1 ? { year: referenceYear - 1, month: 12 } : { year: referenceYear, month: referenceMonth - 1 };
}

@Injectable()
export class HouseholdDashboardService {
  constructor(
    private readonly bills: HouseholdBillsService,
    private readonly cards: HouseholdCardsService,
    private readonly incomes: HouseholdIncomesService,
    private readonly presumedSalary: HouseholdPresumedSalaryService,
  ) {}

  async month(userId: string, referenceYear: number, referenceMonth: number) {
    const [billEntries, cardEntries, incomeEntries] = await Promise.all([
      this.bills.findMonth(userId, referenceYear, referenceMonth),
      this.cards.findMonth(userId, referenceYear, referenceMonth),
      this.incomes.findMonth(userId, referenceYear, referenceMonth),
    ]);

    // "Não precisou pagar esse mês" means exactly that — a skipped bill didn't cost anything this
    // competência, so it's excluded from every BRL total below. It still counts in billsCount and
    // the status breakdown further down, just not in money owed/committed.
    const activeBillEntries = billEntries.filter((e) => e.status !== "SKIPPED");

    // The salary just hasn't landed yet this month — fall back to the configured estimate (live
    // FX-converted if it's set in dólar) instead of showing R$0 income the moment the month rolls
    // over. The instant a real HouseholdIncome shows up for the month, this stops applying.
    const presumedSalaryEstimate = incomeEntries.length === 0 ? await this.presumedSalary.estimateBrl(userId) : null;
    const totalIncome = incomeEntries.length > 0 ? incomeEntries.reduce((sum, i) => sum + Number(i.amount), 0) : presumedSalaryEstimate?.amount ?? 0;
    const totalBills = activeBillEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCards = cardEntries.reduce((sum, e) => sum + e.realAmount, 0);
    const totalCommitted = totalBills + totalCards;
    const totalReserved = activeBillEntries.reduce((sum, e) => sum + Number(e.reservedAmount), 0);
    const totalMandatory = activeBillEntries.filter((e) => e.bill.mandatory).reduce((sum, e) => sum + Number(e.amount), 0) + totalCards;
    const totalOptional = activeBillEntries.filter((e) => !e.bill.mandatory).reduce((sum, e) => sum + Number(e.amount), 0);
    const billsPaidAmount = activeBillEntries.reduce((sum, e) => sum + Number(e.paidAmount), 0);
    const cardsPaidAmount = cardEntries.reduce((sum, e) => sum + (e.paid ? e.realAmount : 0), 0);
    const totalPaid = billsPaidAmount + cardsPaidAmount;
    const totalPending = Math.max(0, totalCommitted - totalPaid);
    const freeBalance = totalIncome - totalCommitted;

    const billsCount = billEntries.length;
    const billsPaidCount = billEntries.filter((e) => e.status === "PAID").length;
    const billsLateCount = billEntries.filter((e) => e.status === "LATE").length;
    const billsSkippedCount = billEntries.filter((e) => e.status === "SKIPPED").length;
    const billsPendingCount = billsCount - billsPaidCount - billsLateCount - billsSkippedCount;
    // "Resolved" = nothing left to do on it this month — paid with money, or skipped because it
    // didn't apply. Drives the "Contas X/Y pagas" tile and the "Contas pagas" ring, so a skipped
    // bill counts the same as a paid one there instead of quietly dragging the ratio down.
    const billsResolvedCount = billsPaidCount + billsSkippedCount;

    const now = new Date();
    const upcomingLimit = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
    const upcomingDue = billEntries
      .filter((e) => e.status !== "PAID" && e.status !== "LATE" && e.status !== "SKIPPED" && e.dueDate >= now && e.dueDate <= upcomingLimit)
      .map((e) => ({ id: e.id, name: e.bill.name, dueDate: e.dueDate, amount: Number(e.amount) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const lateBills = billEntries
      .filter((e) => e.status === "LATE")
      .map((e) => ({ id: e.id, name: e.bill.name, dueDate: e.dueDate, amount: Number(e.amount) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const paidPct = billsCount > 0 ? Math.round((billsResolvedCount / billsCount) * 1000) / 10 : 0;
    const reservedPct = totalBills > 0 ? Math.round((totalReserved / totalBills) * 1000) / 10 : 0;

    const categoryTotals = new Map<string, { name: string; color: string; amount: number }>();
    for (const entry of activeBillEntries) {
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

    const allPaid =
      (billEntries.length > 0 || cardEntries.length > 0) &&
      billEntries.every((e) => e.status === "PAID" || e.status === "SKIPPED") &&
      cardEntries.every((e) => e.paid);

    const foreignIncomeEntries = incomeEntries.filter((i) => i.isForeignCurrency);
    const foreignIncome = {
      count: foreignIncomeEntries.length,
      totalGrossUsd: foreignIncomeEntries.reduce((sum, i) => sum + Number(i.grossAmountForeign ?? 0), 0),
      totalConvertedBrl: foreignIncomeEntries.reduce((sum, i) => sum + Number(i.amount), 0),
      avgRate:
        foreignIncomeEntries.length > 0
          ? Math.round((foreignIncomeEntries.reduce((sum, i) => sum + Number(i.exchangeRate ?? 0), 0) / foreignIncomeEntries.length) * 10000) / 10000
          : null,
    };

    const savingsRate = totalIncome > 0 ? Math.round((freeBalance / totalIncome) * 1000) / 10 : null;

    const { year: prevYear, month: prevMonth } = previousMonthOf(referenceYear, referenceMonth);
    const [prevBillEntries, prevCardEntries] = await Promise.all([
      this.bills.findMonth(userId, prevYear, prevMonth),
      this.cards.findMonth(userId, prevYear, prevMonth),
    ]);
    const prevActiveBillEntries = prevBillEntries.filter((e) => e.status !== "SKIPPED");
    const prevTotalCommitted =
      prevActiveBillEntries.reduce((sum, e) => sum + Number(e.amount), 0) + prevCardEntries.reduce((sum, e) => sum + e.realAmount, 0);
    const prevTotalPaid =
      prevActiveBillEntries.reduce((sum, e) => sum + Number(e.paidAmount), 0) +
      prevCardEntries.reduce((sum, e) => sum + (e.paid ? e.realAmount : 0), 0);
    const previousMonthComparison = {
      referenceYear: prevYear,
      referenceMonth: prevMonth,
      totalCommitted: prevTotalCommitted,
      totalPaid: prevTotalPaid,
      deltaCommittedPct: prevTotalCommitted > 0 ? Math.round(((totalCommitted - prevTotalCommitted) / prevTotalCommitted) * 1000) / 10 : null,
    };

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
      billsResolvedCount,
      billsPendingCount,
      billsLateCount,
      billsSkippedCount,
      upcomingDue,
      lateBills,
      paidPct,
      reservedPct,
      incomeVsExpenses: { income: totalIncome, expenses: totalCommitted },
      billsByCategory,
      paymentEvolution,
      allPaid,
      foreignIncome,
      presumedSalary: presumedSalaryEstimate
        ? { applied: true, amount: presumedSalaryEstimate.amount, isForeignCurrency: presumedSalaryEstimate.isForeignCurrency, rateUsed: presumedSalaryEstimate.rateUsed }
        : { applied: false, amount: 0, isForeignCurrency: false, rateUsed: null },
      savingsRate,
      previousMonthComparison,
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
