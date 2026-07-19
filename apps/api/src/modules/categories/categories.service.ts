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

  private async getOwned(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.userId && category.userId !== userId) throw new ForbiddenException();
    return category;
  }
}
