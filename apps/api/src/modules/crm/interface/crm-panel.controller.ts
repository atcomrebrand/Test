import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import {
  CreatePanelMovementDto,
  CreatePanelRechargeDto,
  CrmPanelService,
} from "../application/crm-panel.service";
import { CrmCatalogService } from "../application/crm-catalog.service";

/** Estoque próprio de créditos — o que abastece as renovações. */
@UseGuards(JwtAuthGuard)
@Controller("crm/panel")
export class CrmPanelController {
  constructor(
    private readonly service: CrmPanelService,
    private readonly catalog: CrmCatalogService,
  ) {}

  /** Saldo de todos os serviços de uma vez — é como a tela abre. */
  @Get("balances")
  async balances(@CurrentUser() user: AuthUser) {
    const portfolios = await this.catalog.listPortfolios(user.userId);
    const ids = portfolios.map((p) => p.id);
    const [balances, prices, settings] = await Promise.all([
      this.service.balances(user.userId, ids),
      this.service.averagePrices(user.userId, ids),
      this.catalog.getSettings(user.userId),
    ]);

    return portfolios.map((p) => {
      const balance = balances.get(p.id) ?? 0;
      const averagePrice = prices.get(p.id) ?? null;
      return {
        portfolio: p,
        currency: p.currency,
        balance,
        averagePrice,
        stockValue: averagePrice !== null ? Math.round(balance * averagePrice * 100) / 100 : null,
        lowCredit: balance <= settings.panelLowCreditThreshold,
        threshold: settings.panelLowCreditThreshold,
      };
    });
  }

  @Get(":portfolioId")
  overview(@CurrentUser() user: AuthUser, @Param("portfolioId") portfolioId: string) {
    return this.service.overview(user.userId, portfolioId);
  }

  @Post("recharges")
  recharge(@CurrentUser() user: AuthUser, @Body() dto: CreatePanelRechargeDto) {
    return this.service.recharge(user.userId, dto);
  }

  @Post("movements")
  addMovement(@CurrentUser() user: AuthUser, @Body() dto: CreatePanelMovementDto) {
    return this.service.addMovement(user.userId, dto);
  }
}
