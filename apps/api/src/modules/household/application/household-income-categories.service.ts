import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdIncomeCategoryDto, UpdateHouseholdIncomeCategoryDto } from "./dto/household-income-category.dto";

@Injectable()
export class HouseholdIncomeCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.householdIncomeCategory.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  async create(userId: string, dto: CreateHouseholdIncomeCategoryDto) {
    const existing = await this.prisma.householdIncomeCategory.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException("Você já possui uma categoria com este nome.");

    const maxOrder = await this.prisma.householdIncomeCategory.aggregate({ where: { userId }, _max: { order: true } });
    return this.prisma.householdIncomeCategory.create({
      data: { ...dto, userId, order: (maxOrder._max.order ?? -1) + 1 },
    });
  }

  async update(userId: string, id: string, dto: UpdateHouseholdIncomeCategoryDto) {
    await this.getOwned(userId, id);
    return this.prisma.householdIncomeCategory.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);

    const inUse = await this.prisma.householdIncome.count({ where: { categoryId: id } });
    if (inUse > 0) throw new BadRequestException("Categoria em uso por entradas existentes.");

    await this.prisma.householdIncomeCategory.delete({ where: { id } });
    return { id };
  }

  async reorder(userId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.householdIncomeCategory.updateMany({ where: { id, userId }, data: { order: index } })),
    );
    return this.findAll(userId);
  }

  /** Guard for HouseholdIncomesService — same reasoning as the bill categories' assertOwned. */
  async assertOwned(userId: string, categoryId: string) {
    await this.getOwned(userId, categoryId);
  }

  private async getOwned(userId: string, id: string) {
    const category = await this.prisma.householdIncomeCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.userId !== userId) throw new ForbiddenException();
    return category;
  }
}
