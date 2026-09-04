import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { AssetsService } from "../application/assets.service";
import { UpdateIncomeDto, UpdateTransactionDto } from "../application/dto/asset.dto";

/** A single "place" to see, correct or remove every transaction/income across the whole
 *  portfolio — the per-asset detail page shows a read-only lançamentos list, but cleaning up
 *  after a bulk import (wrong row, duplicate, wrong date) is much less tedious from one global
 *  view than hopping into each asset individually. Kept as its own controller (rather than nested
 *  under /investments/assets/:id) so "transactions"/"incomes" as static path segments can't
 *  collide with the assets controller's :id wildcard route. */
@UseGuards(JwtAuthGuard)
@Controller("investments/lancamentos")
export class LaunchesController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [transactions, incomes] = await Promise.all([this.service.listAllTransactions(user.userId), this.service.listAllIncomes(user.userId)]);
    return { transactions, incomes };
  }

  @Patch("transactions/:id")
  updateTransaction(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateTransactionDto) {
    return this.service.updateTransaction(user.userId, id, dto);
  }

  @Delete("transactions/:id")
  removeTransaction(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeTransaction(user.userId, id);
  }

  @Patch("incomes/:id")
  updateIncome(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateIncomeDto) {
    return this.service.updateIncome(user.userId, id, dto);
  }

  @Delete("incomes/:id")
  removeIncome(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeIncome(user.userId, id);
  }
}
