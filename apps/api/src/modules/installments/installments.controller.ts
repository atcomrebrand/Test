import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { InstallmentsService } from "./installments.service";
import { InstallmentQueryDto, PayInstallmentDto, UpdateInstallmentStatusDto } from "./dto/installment.dto";

@UseGuards(JwtAuthGuard)
@Controller("installments")
export class InstallmentsController {
  constructor(private readonly service: InstallmentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: InstallmentQueryDto) {
    return this.service.findAll(user.userId, query);
  }

  @Post(":id/pay")
  pay(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PayInstallmentDto) {
    return this.service.pay(user.userId, id, dto);
  }

  @Post(":id/unpay")
  unpay(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.unpay(user.userId, id);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateInstallmentStatusDto) {
    return this.service.updateStatus(user.userId, id, dto);
  }
}
