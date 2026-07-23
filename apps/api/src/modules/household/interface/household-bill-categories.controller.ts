import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdBillCategoriesService } from "../application/household-bill-categories.service";
import {
  CreateHouseholdBillCategoryDto,
  ReorderHouseholdBillCategoriesDto,
  UpdateHouseholdBillCategoryDto,
} from "../application/dto/household-bill-category.dto";

@UseGuards(JwtAuthGuard)
@Controller("household/bill-categories")
export class HouseholdBillCategoriesController {
  constructor(private readonly service: HouseholdBillCategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseholdBillCategoryDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch("reorder")
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderHouseholdBillCategoriesDto) {
    return this.service.reorder(user.userId, dto.ids);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateHouseholdBillCategoryDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
