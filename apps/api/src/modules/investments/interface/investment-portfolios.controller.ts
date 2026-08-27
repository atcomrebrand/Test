import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { InvestmentPortfoliosService } from "../application/investment-portfolios.service";
import { FixedIncomesService } from "../application/fixed-incomes.service";
import { CreateInvestmentPortfolioDto, UpdateInvestmentPortfolioDto } from "../application/dto/investment-portfolio.dto";

@UseGuards(JwtAuthGuard)
@Controller("investments/portfolios")
export class InvestmentPortfoliosController {
  constructor(
    private readonly service: InvestmentPortfoliosService,
    private readonly fixedIncomes: FixedIncomesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  /** As aplicações desta carteira. Rota própria, e não um filtro no endpoint de renda fixa, pra o
   *  endpoint existente continuar significando exatamente o que sempre significou. */
  @Get(":id/fixed-incomes")
  async fixedIncomesOf(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.service.getOwned(user.userId, id);
    return this.fixedIncomes.findAll(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvestmentPortfolioDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateInvestmentPortfolioDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query() _q: unknown) {
    return this.service.remove(user.userId, id);
  }
}
