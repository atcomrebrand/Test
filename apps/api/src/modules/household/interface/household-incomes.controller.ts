import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdIncomesService } from "../application/household-incomes.service";
import { CreateHouseholdIncomeDto, UpdateHouseholdIncomeDto } from "../application/dto/household-income.dto";

@UseGuards(JwtAuthGuard)
@Controller("household/incomes")
export class HouseholdIncomesController {
  constructor(private readonly service: HouseholdIncomesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Get("month/:year/:month")
  findMonth(
    @CurrentUser() user: AuthUser,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    return this.service.findMonth(user.userId, year, month);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseholdIncomeDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateHouseholdIncomeDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
