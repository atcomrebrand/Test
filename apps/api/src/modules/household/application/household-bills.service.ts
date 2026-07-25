import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { HouseholdBillRepository, HouseholdBillWithCategory } from "../domain/household-bill.repository";
import { HouseholdBillEntryRepository, HouseholdBillEntryWithBill } from "../domain/household-bill-entry.repository";
import { computeBillEntryStatus } from "../domain/bill-entry-status";
import { resolveDueDate } from "../domain/resolve-due-date";
import { HouseholdAuditService } from "./household-audit.service";
import { CreateHouseholdBillDto, UpdateHouseholdBillDto, UpdateHouseholdBillEntryDto } from "./dto/household-bill.dto";

@Injectable()
export class HouseholdBillsService {
  constructor(
    private readonly bills: HouseholdBillRepository,
    private readonly entries: HouseholdBillEntryRepository,
    private readonly audit: HouseholdAuditService,
  ) {}

  findAll(userId: string) {
    return this.bills.findAllByUser(userId);
  }

  async create(userId: string, dto: CreateHouseholdBillDto) {
    const bill = await this.bills.create({
      userId,
      categoryId: dto.categoryId,
      name: dto.name,
      dueDay: dto.dueDay,
      defaultAmount: dto.defaultAmount,
      allowAmountChange: dto.allowAmountChange,
      mandatory: dto.mandatory,
      notes: dto.notes,
    });
    await this.audit.log(userId, "HouseholdBill", bill.id, "CREATE", null, bill);
    return bill;
  }

  async update(userId: string, id: string, dto: UpdateHouseholdBillDto) {
    const before = await this.getOwnedBill(userId, id);
    const after = await this.bills.update(id, { ...dto });
    await this.audit.log(userId, "HouseholdBill", id, "UPDATE", before, after);
    return after;
  }

  /** Always deletes, cascading every competência already lançada (HouseholdBillEntry has
   *  onDelete: Cascade) — the choice between keeping history (desativar) and erasing it (excluir)
   *  belongs to the user, made explicit in the frontend's confirmation dialog before this is ever
   *  called. The DELETE audit entry itself is the only trace that survives either way. */
  async remove(userId: string, id: string) {
    const before = await this.getOwnedBill(userId, id);
    await this.bills.delete(id);
    await this.audit.log(userId, "HouseholdBill", id, "DELETE", before, null);
    return { id };
  }

  /** The monthly table screen's main entry point — generates any missing competência for active
   *  bills on demand (no cron, no "iniciar mês" button needed) before returning the month. */
  async findMonth(userId: string, referenceYear: number, referenceMonth: number) {
    await this.ensureMonthGenerated(userId, referenceYear, referenceMonth);
    return this.entries.findByMonth(userId, referenceYear, referenceMonth);
  }

  async ensureMonthGenerated(userId: string, referenceYear: number, referenceMonth: number) {
    const activeBills = await this.bills.findActiveByUser(userId);
    if (activeBills.length === 0) return;

    const existingBillIds = await this.entries.findExistingBillIdsForMonth(userId, referenceYear, referenceMonth);
    const missing = activeBills.filter((b) => !existingBillIds.has(b.id));
    if (missing.length === 0) return;

    const toCreate = missing.map((bill) => {
      const dueDate = resolveDueDate(referenceYear, referenceMonth, bill.dueDay);
      const amount = Number(bill.defaultAmount);
      const status = computeBillEntryStatus({ amount, reservedAmount: 0, paidAmount: 0, dueDate });
      return { userId, billId: bill.id, referenceYear, referenceMonth, dueDate, amount, status };
    });

    await this.entries.createMany(toCreate);
  }

  async updateEntry(userId: string, id: string, dto: UpdateHouseholdBillEntryDto) {
    const before = await this.getOwnedEntry(userId, id);

    if (dto.amount !== undefined && !before.bill.allowAmountChange) {
      throw new BadRequestException("Esta conta não permite alterar o valor mensal.");
    }

    const amount = dto.amount ?? Number(before.amount);
    const reservedAmount = dto.reservedAmount ?? Number(before.reservedAmount);
    const paidAmount = dto.paidAmount ?? Number(before.paidAmount);
    const status = computeBillEntryStatus({ amount, reservedAmount, paidAmount, dueDate: before.dueDate });

    const wasPaid = before.status === "PAID";
    const isPaid = status === "PAID";
    const paidAt = isPaid ? (wasPaid ? before.paidAt : new Date()) : null;

    const after = await this.entries.update(id, {
      amount,
      reservedAmount,
      paidAmount,
      status,
      paidAt,
      notes: dto.notes ?? before.notes ?? undefined,
    });
    await this.audit.log(userId, "HouseholdBillEntry", id, "UPDATE", this.snapshotEntry(before), this.snapshotEntry(after));
    return after;
  }

  private snapshotEntry(entry: HouseholdBillEntryWithBill) {
    return { amount: entry.amount, reservedAmount: entry.reservedAmount, paidAmount: entry.paidAmount, status: entry.status };
  }

  private async getOwnedBill(userId: string, id: string): Promise<HouseholdBillWithCategory> {
    const bill = await this.bills.findById(id);
    if (!bill) throw new NotFoundException("Conta não encontrada.");
    if (bill.userId !== userId) throw new ForbiddenException();
    return bill;
  }

  private async getOwnedEntry(userId: string, id: string): Promise<HouseholdBillEntryWithBill> {
    const entry = await this.entries.findById(id);
    if (!entry) throw new NotFoundException("Competência não encontrada.");
    if (entry.userId !== userId) throw new ForbiddenException();
    return entry;
  }
}
