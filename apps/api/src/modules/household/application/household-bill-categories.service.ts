import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateHouseholdBillCategoryDto, UpdateHouseholdBillCategoryDto } from "./dto/household-bill-category.dto";

@Injectable()
export class HouseholdBillCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.householdBillCategory.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  async create(userId: string, dto: CreateHouseholdBillCategoryDto) {
    const existing = await this.prisma.householdBillCategory.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException("Você já possui uma categoria com este nome.");

    const maxOrder = await this.prisma.householdBillCategory.aggregate({ where: { userId }, _max: { order: true } });
    return this.prisma.householdBillCategory.create({
      data: { ...dto, userId, order: (maxOrder._max.order ?? -1) + 1 },
    });
  }

  async update(userId: string, id: string, dto: UpdateHouseholdBillCategoryDto) {
    await this.getOwned(userId, id);
    return this.prisma.householdBillCategory.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);

    const inUse = await this.prisma.householdBill.count({ where: { categoryId: id } });
    if (inUse > 0) throw new BadRequestException("Categoria em uso por contas existentes.");

    await this.prisma.householdBillCategory.delete({ where: { id } });
    return { id };
  }

  async reorder(userId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.householdBillCategory.updateMany({ where: { id, userId }, data: { order: index } })),
    );
    return this.findAll(userId);
  }

  /** Guard for HouseholdBillsService, which takes a categoryId straight from the client and joins
   *  the category into every response. Unlike the Parcelamento categories, these always have an
   *  owner — there are no shared defaults — so the rule is simply "yours or nothing". */
  async assertOwned(userId: string, categoryId: string) {
    await this.getOwned(userId, categoryId);
  }

  private async getOwned(userId: string, id: string) {
    const category = await this.prisma.householdBillCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.userId !== userId) throw new ForbiddenException();
    return category;
  }
}
