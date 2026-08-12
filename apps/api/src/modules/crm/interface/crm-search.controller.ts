import { Body, Controller, Get, Header, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CrmSearchService } from "../application/crm-search.service";
import { CrmAuditService } from "../application/crm-audit.service";

@UseGuards(JwtAuthGuard)
@Controller("crm")
export class CrmSearchController {
  constructor(
    private readonly service: CrmSearchService,
    private readonly audit: CrmAuditService,
  ) {}

  @Get("search")
  search(@CurrentUser() user: AuthUser, @Query("q") q: string, @Query("portfolioId") portfolioId?: string) {
    return this.service.search(user.userId, q ?? "", portfolioId);
  }

  /** Devolve o texto pronto e o link. Nunca envia — o disparo é sempre um clique do usuário. */
  @Post("messages/render")
  renderMessage(
    @CurrentUser() user: AuthUser,
    @Body() body: { templateId: string; customerId?: string; linkId?: string },
  ) {
    return this.service.renderMessage(user.userId, body.templateId, {
      customerId: body.customerId,
      linkId: body.linkId,
    });
  }

  @Get("audit")
  audit_(@CurrentUser() user: AuthUser) {
    return this.audit.list(user.userId);
  }

  @Get("export/customers")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="clientes.csv"')
  exportCustomers(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.exportCustomers(user.userId, portfolioId);
  }

  @Get("export/resellers")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="revendedores.csv"')
  exportResellers(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.exportResellers(user.userId, portfolioId);
  }
}
