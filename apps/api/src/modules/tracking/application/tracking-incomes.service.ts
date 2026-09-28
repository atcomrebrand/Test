import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingIncomeRepository } from "../domain/tracking-income.repository";
import { TrackingAuditService } from "./tracking-audit.service";
import { CreateTrackingIncomeDto, UpdateTrackingIncomeDto } from "./dto/tracking-income.dto";

@Injectable()
export class TrackingIncomesService {
  constructor(
    private readonly incomes: TrackingIncomeRepository,
    private readonly audit: TrackingAuditService,
  ) {}

  findAll(userId: string) {
    return this.incomes.findAllByUser(userId);
  }

  async findOne(userId: string, id: string) {
    return this.getOwned(userId, id);
  }

  async create(userId: string, dto: CreateTrackingIncomeDto) {
    const income = await this.incomes.create({
      userId,
      name: dto.name,
      category: dto.category,
      amount: dto.amount,
      date: new Date(dto.date),
      notes: dto.notes,
    });
    await this.audit.log(userId, "TrackingIncome", income.id, "CREATE", null, income);
    return income;
  }

  async update(userId: string, id: string, dto: UpdateTrackingIncomeDto) {
    const before = await this.getOwned(userId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    const after = await this.incomes.update(id, data);
    await this.audit.log(userId, "TrackingIncome", id, "UPDATE", before, after);
    return after;
  }

  async remove(userId: string, id: string) {
    const before = await this.getOwned(userId, id);
    await this.incomes.softDelete(id);
    await this.audit.log(userId, "TrackingIncome", id, "DELETE", before, null);
    return { id };
  }

  private async getOwned(userId: string, id: string) {
    const income = await this.incomes.findById(id);
    if (!income) throw new NotFoundException("Entrada não encontrada.");
    if (income.userId !== userId) throw new ForbiddenException();
    return income;
  }
}
