import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException("Você já possui uma categoria com este nome.");

    return this.prisma.category.create({
      data: { ...dto, userId, isDefault: false },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.getOwned(userId, id);
    if (category.isDefault) throw new ForbiddenException("Categorias padrão não podem ser editadas.");

    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const category = await this.getOwned(userId, id);
    if (category.isDefault) throw new ForbiddenException("Categorias padrão não podem ser excluídas.");

    const inUse = await this.prisma.purchase.count({ where: { categoryId: id } });
    if (inUse > 0) throw new BadRequestException("Categoria em uso por compras existentes.");

    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  /**
   * Guard for other modules that accept a categoryId straight from the client. Without it, a user
   * can attach their own purchase to someone else's category — the row then comes back with the
   * category joined in, leaking its name and colour to whoever asked.
   *
   * "Usable" is deliberately wider than "owned": a category with no userId is a system default,
   * shared by everyone on purpose, and rejecting those would break categorisation for every user.
   */
  async assertUsable(userId: string, categoryId: string) {
    await this.getOwned(userId, categoryId);
  }

  private async getOwned(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.userId && category.userId !== userId) throw new ForbiddenException();
    return category;
  }
}
