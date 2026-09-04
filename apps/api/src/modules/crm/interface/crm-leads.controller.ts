import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import {
  ConvertLeadDto,
  CreateCrmLeadDto,
  CrmLeadsService,
  UpdateCrmLeadDto,
} from "../application/crm-leads.service";
import { CrmLeadStage } from "../domain/crm-lead.repository";

@UseGuards(JwtAuthGuard)
@Controller("crm/leads")
export class CrmLeadsController {
  constructor(private readonly service: CrmLeadsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("portfolioId") portfolioId?: string,
    @Query("stage") stage?: CrmLeadStage,
    @Query("originId") originId?: string,
    @Query("search") search?: string,
  ) {
    return this.service.list(user.userId, { portfolioId, stage, originId, search });
  }

  @Get("stats")
  stats(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.stats(user.userId, portfolioId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmLeadDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmLeadDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Patch(":id/stage")
  moveStage(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { stage: string }) {
    return this.service.moveStage(user.userId, id, body.stage);
  }

  @Post(":id/convert")
  convert(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ConvertLeadDto) {
    return this.service.convert(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
