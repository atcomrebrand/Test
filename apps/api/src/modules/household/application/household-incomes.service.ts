import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { HouseholdIncomeRepository, HouseholdIncomeWithCategory } from "../domain/household-income.repository";
import { HouseholdAuditService } from "./household-audit.service";
import { CreateHouseholdIncomeDto, UpdateHouseholdIncomeDto } from "./dto/household-income.dto";

@Injectable()
export class HouseholdIncomesService {
  constructor(
    private readonly incomes: HouseholdIncomeRepository,
    private readonly audit: HouseholdAuditService,
  ) {}

  findAll(userId: string) {
    return this.incomes.findAllByUser(userId);
  }

  findMonth(userId: string, referenceYear: number, referenceMonth: number) {
    return this.incomes.findByMonth(userId, referenceYear, referenceMonth);
  }

  async create(userId: string, dto: CreateHouseholdIncomeDto) {
    const isForeignCurrency = dto.isForeignCurrency ?? false;

    const income = await this.incomes.create({
      userId,
      categoryId: dto.categoryId,
      date: new Date(dto.date),
      description: dto.description,
      amount: dto.amount,
      isForeignCurrency,
      grossAmountForeign: isForeignCurrency ? dto.grossAmountForeign : undefined,
      exchangeRate: isForeignCurrency ? dto.exchangeRate : undefined,
      notes: dto.notes,
    });
    await this.audit.log(userId, "HouseholdIncome", income.id, "CREATE", null, income);
    return income;
  }

  async update(userId: string, id: string, dto: UpdateHouseholdIncomeDto) {
    const before = await this.getOwned(userId, id);

    const isForeignCurrency = dto.isForeignCurrency ?? before.isForeignCurrency;

    const data: Record<string, unknown> = {
      ...dto,
      isForeignCurrency,
      grossAmountForeign: isForeignCurrency ? (dto.grossAmountForeign ?? Number(before.grossAmountForeign ?? 0)) : null,
      exchangeRate: isForeignCurrency ? (dto.exchangeRate ?? Number(before.exchangeRate ?? 0)) : null,
    };
    if (dto.date) data.date = new Date(dto.date);

    const after = await this.incomes.update(id, data);
    await this.audit.log(userId, "HouseholdIncome", id, "UPDATE", before, after);
    return after;
  }

  async remove(userId: string, id: string) {
    const before = await this.getOwned(userId, id);
    await this.incomes.delete(id);
    await this.audit.log(userId, "HouseholdIncome", id, "DELETE", before, null);
    return { id };
  }

  private async getOwned(userId: string, id: string): Promise<HouseholdIncomeWithCategory> {
    const income = await this.incomes.findById(id);
    if (!income) throw new NotFoundException("Entrada não encontrada.");
    if (income.userId !== userId) throw new ForbiddenException();
    return income;
  }
}
