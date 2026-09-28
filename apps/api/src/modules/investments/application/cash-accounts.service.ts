import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CashAccountRepository } from "../domain/cash-account.repository";
import { CreateCashAccountDto, UpdateCashAccountDto } from "./dto/cash-account.dto";

@Injectable()
export class CashAccountsService {
  constructor(private readonly cashAccounts: CashAccountRepository) {}

  findAll(userId: string) {
    return this.cashAccounts.findAllByUser(userId);
  }

  create(userId: string, dto: CreateCashAccountDto) {
    return this.cashAccounts.create({ userId, name: dto.name, institution: dto.institution, balance: dto.balance, notes: dto.notes });
  }

  async update(userId: string, id: string, dto: UpdateCashAccountDto) {
    await this.getOwned(userId, id);
    return this.cashAccounts.update(id, dto as Record<string, unknown>);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.cashAccounts.softDelete(id);
    return { id };
  }

  private async getOwned(userId: string, id: string) {
    const account = await this.cashAccounts.findById(id);
    if (!account || account.deletedAt) throw new NotFoundException("Conta não encontrada.");
    if (account.userId !== userId) throw new ForbiddenException();
    return account;
  }
}
