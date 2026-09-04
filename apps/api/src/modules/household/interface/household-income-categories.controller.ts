import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdIncomeCategoriesService } from "../application/household-income-categories.service";
import {
  CreateHouseholdIncomeCategoryDto,
  ReorderHouseholdIncomeCategoriesDto,
  UpdateHouseholdIncomeCategoryDto,
} from "../application/dto/household-income-category.dto";

@UseGuards(JwtAuthGuard)
@Controller("household/income-categories")
export class HouseholdIncomeCategoriesController {
  constructor(private readonly service: HouseholdIncomeCategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseholdIncomeCategoryDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch("reorder")
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderHouseholdIncomeCategoriesDto) {
    return this.service.reorder(user.userId, dto.ids);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateHouseholdIncomeCategoryDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
