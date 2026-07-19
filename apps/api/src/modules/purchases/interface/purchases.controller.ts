import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { PurchasesService } from "../application/purchases.service";
import { CreatePurchaseDto, PurchaseQueryDto, UpdatePurchaseDto } from "../application/dto/purchase.dto";

@UseGuards(JwtAuthGuard)
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: PurchaseQueryDto) {
    return this.service.findAll(user.userId, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.service.create(user.userId, dto);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.duplicate(user.userId, id);
  }

  @Post(":id/restore")
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.restore(user.userId, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePurchaseDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.softDelete(user.userId, id);
  }

  @Delete(":id/permanent")
  removePermanent(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.hardDelete(user.userId, id);
  }
}
