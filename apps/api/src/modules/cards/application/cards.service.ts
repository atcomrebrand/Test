import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CardRepository } from "../domain/card.repository";
import { CardEntity } from "../domain/card.entity";
import { CreateCardDto, UpdateCardDto } from "./dto/card.dto";

@Injectable()
export class CardsService {
  constructor(private readonly cards: CardRepository) {}

  findAll(userId: string) {
    return this.cards.findAllByUser(userId);
  }

  async findOne(userId: string, id: string) {
    return this.getOwned(userId, id);
  }

  async create(userId: string, dto: CreateCardDto) {
    CardEntity.validateDays(dto.closingDay, dto.dueDay);
    CardEntity.validateLimit(dto.limitAmount);

    return this.cards.create({
      userId,
      name: dto.name,
      bank: dto.bank,
      brand: dto.brand,
      color: dto.color ?? "#6D5BFF",
      limitAmount: dto.limitAmount,
      lastDigits: dto.lastDigits,
      closingDay: dto.closingDay,
      dueDay: dto.dueDay,
    });
  }

  async update(userId: string, id: string, dto: UpdateCardDto) {
    await this.getOwned(userId, id);

    if (dto.closingDay !== undefined || dto.dueDay !== undefined) {
      const card = await this.cards.findById(id);
      CardEntity.validateDays(dto.closingDay ?? card!.closingDay, dto.dueDay ?? card!.dueDay);
    }
    if (dto.limitAmount !== undefined) CardEntity.validateLimit(dto.limitAmount);

    return this.cards.update(id, dto);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    const purchaseCount = await this.cards.countPurchases(id);
    if (purchaseCount > 0) {
      throw new BadRequestException(
        "Não é possível excluir um cartão com compras associadas. Desative-o em vez disso.",
      );
    }
    await this.cards.delete(id);
    return { id };
  }

  async usage(userId: string, id: string) {
    const card = await this.getOwned(userId, id);
    const spent = await this.cards.sumSpentByCard(id);
    const limit = Number(card.limitAmount);
    return {
      limit,
      spent,
      available: Math.max(limit - spent, 0),
      usagePct: limit > 0 ? Math.min((spent / limit) * 100, 100) : 0,
    };
  }

  private async getOwned(userId: string, id: string) {
    const card = await this.cards.findById(id);
    if (!card) throw new NotFoundException("Cartão não encontrado.");
    if (card.userId !== userId) throw new ForbiddenException();
    return card;
  }
}
