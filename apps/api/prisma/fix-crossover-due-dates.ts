/**
 * One-off data fix: `generateInstallments` used to compute an installment's due date within the
 * same month as its `referenceMonth` (competência) regardless of the card's closing/due days. For
 * any card where `dueDay < closingDay` (e.g. closes the 28th, due the 5th — the bill is only
 * finalized after the closing day, so it can only be due the *following* month), that put the due
 * date before the invoice even closed. This recomputes the correct due date for every affected
 * installment.
 *
 * The auto-settle sweep (`autoSettleOverdueInstallments`) flips PENDING/LATE installments to PAID
 * once `dueDate < now`, stamping `Payment.paidAt` with the exact `dueDate` value. Installments
 * auto-settled off the old, too-early due date carry that fingerprint (`paidAt === old dueDate`);
 * if the corrected due date is still in the future, that installment was settled prematurely and
 * gets reverted to PENDING (mirrors `InstallmentsService.unpay()`). A manually-paid installment
 * has `paidAt` set to whenever the user actually clicked pay, so it never matches this fingerprint
 * and is left untouched — only its `dueDate` display value gets corrected.
 *
 * Safe to re-run — installments already correct or already reverted are no-ops.
 *   pnpm exec ts-node prisma/fix-crossover-due-dates.ts           # dry run, reports only
 *   pnpm exec ts-node prisma/fix-crossover-due-dates.ts --apply   # applies the fix
 */
import { PrismaClient } from "@prisma/client";
import { addMonths } from "../src/modules/purchases/domain/installment-generator";
import { dateForDayInMonth } from "../src/common/date/day-of-month";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const allCards = await prisma.card.findMany({
    select: { id: true, name: true, userId: true, closingDay: true, dueDay: true },
  });
  const cards = allCards.filter((c) => c.dueDay < c.closingDay);

  if (cards.length === 0) {
    console.log("Nenhum cartão com vencimento antes do fechamento — nada para corrigir.");
    return;
  }

  console.log(`${cards.length} cartão(ões) com vencimento cruzando o mês (fecha depois do dia que vence):`);
  cards.forEach((c) => console.log(`  - ${c.name} (fecha dia ${c.closingDay}, vence dia ${c.dueDay})`));

  let correctedDueDate = 0;
  let revertedToPending = 0;
  const now = new Date();

  for (const card of cards) {
    const installments = await prisma.installment.findMany({
      where: { cardId: card.id },
      include: { payment: true },
    });

    for (const inst of installments) {
      const due = addMonths(inst.referenceYear, inst.referenceMonth, 1);
      const correctDueDate = dateForDayInMonth(due.year, due.month, card.dueDay);

      if (correctDueDate.getTime() === inst.dueDate.getTime()) continue; // already correct

      const wasAutoSettledOffOldDate =
        inst.status === "PAID" && !!inst.payment && inst.payment.paidAt.getTime() === inst.dueDate.getTime();
      const shouldRevert = wasAutoSettledOffOldDate && correctDueDate.getTime() > now.getTime();

      console.log(
        `  ${apply ? "" : "[dry-run] "}Parcela ${inst.id} (${card.name}, competência ${inst.referenceMonth}/${inst.referenceYear}): ` +
          `${inst.dueDate.toISOString().slice(0, 10)} -> ${correctDueDate.toISOString().slice(0, 10)}` +
          (shouldRevert ? "  [revertendo PAID -> PENDING, quitada cedo demais pelo bug]" : ""),
      );

      correctedDueDate++;
      if (shouldRevert) revertedToPending++;

      if (!apply) continue;

      await prisma.$transaction([
        prisma.installment.update({
          where: { id: inst.id },
          data: { dueDate: correctDueDate, ...(shouldRevert ? { status: "PENDING" } : {}) },
        }),
        ...(shouldRevert ? [prisma.payment.delete({ where: { id: inst.payment!.id } })] : []),
      ]);
    }
  }

  console.log(
    `\n${apply ? "Aplicado" : "[dry-run] Seriam corrigidas"}: ${correctedDueDate} parcela(s) com data de vencimento errada, ${revertedToPending} revertida(s) de PAID para PENDING.`,
  );
  if (!apply) console.log("Rode de novo com --apply para gravar as mudanças.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
