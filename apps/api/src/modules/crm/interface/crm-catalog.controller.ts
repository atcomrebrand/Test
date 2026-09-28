import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CrmCatalogService } from "../application/crm-catalog.service";
import {
  CreateCrmOriginDto,
  CreateCrmPaymentMethodDto,
  CreateCrmPlanDto,
  CreateCrmPortfolioDto,
  CreateCrmTagDto,
  CreateCrmTemplateDto,
  UpdateCrmOriginDto,
  UpdateCrmPaymentMethodDto,
  UpdateCrmPlanDto,
  UpdateCrmPortfolioDto,
  UpdateCrmSettingsDto,
  UpdateCrmTemplateDto,
} from "../application/dto/crm-catalog.dto";

@UseGuards(JwtAuthGuard)
@Controller("crm")
export class CrmCatalogController {
  constructor(private readonly service: CrmCatalogService) {}

  @Get("portfolios")
  listPortfolios(@CurrentUser() user: AuthUser) {
    return this.service.listPortfolios(user.userId);
  }

  @Post("portfolios")
  createPortfolio(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmPortfolioDto) {
    return this.service.createPortfolio(user.userId, dto);
  }

  @Patch("portfolios/:id")
  updatePortfolio(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmPortfolioDto) {
    return this.service.updatePortfolio(user.userId, id, dto);
  }

  @Get("plans")
  listPlans(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.listPlans(user.userId, portfolioId);
  }

  @Post("plans")
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmPlanDto) {
    return this.service.createPlan(user.userId, dto);
  }

  @Patch("plans/:id")
  updatePlan(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmPlanDto) {
    return this.service.updatePlan(user.userId, id, dto);
  }

  @Delete("plans/:id")
  deletePlan(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.deletePlan(user.userId, id);
  }

  @Get("payment-methods")
  listPaymentMethods(@CurrentUser() user: AuthUser) {
    return this.service.listPaymentMethods(user.userId);
  }

  @Post("payment-methods")
  createPaymentMethod(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmPaymentMethodDto) {
    return this.service.createPaymentMethod(user.userId, dto);
  }

  @Patch("payment-methods/:id")
  updatePaymentMethod(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateCrmPaymentMethodDto,
  ) {
    return this.service.updatePaymentMethod(user.userId, id, dto);
  }

  @Delete("payment-methods/:id")
  deletePaymentMethod(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.deletePaymentMethod(user.userId, id);
  }

  @Get("origins")
  listOrigins(@CurrentUser() user: AuthUser) {
    return this.service.listOrigins(user.userId);
  }

  @Post("origins")
  createOrigin(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmOriginDto) {
    return this.service.createOrigin(user.userId, dto);
  }

  @Patch("origins/:id")
  updateOrigin(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmOriginDto) {
    return this.service.updateOrigin(user.userId, id, dto);
  }

  @Delete("origins/:id")
  deleteOrigin(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.deleteOrigin(user.userId, id);
  }

  @Get("tags")
  listTags(@CurrentUser() user: AuthUser) {
    return this.service.listTags(user.userId);
  }

  @Post("tags")
  createTag(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmTagDto) {
    return this.service.createTag(user.userId, dto);
  }

  @Delete("tags/:id")
  deleteTag(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.deleteTag(user.userId, id);
  }

  @Get("templates")
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.service.listTemplates(user.userId);
  }

  @Post("templates")
  createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmTemplateDto) {
    return this.service.createTemplate(user.userId, dto);
  }

  @Patch("templates/:id")
  updateTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmTemplateDto) {
    return this.service.updateTemplate(user.userId, id, dto);
  }

  @Delete("templates/:id")
  deleteTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.deleteTemplate(user.userId, id);
  }

  @Get("settings")
  getSettings(@CurrentUser() user: AuthUser) {
    return this.service.getSettings(user.userId);
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateCrmSettingsDto) {
    return this.service.updateSettings(user.userId, dto);
  }
}
