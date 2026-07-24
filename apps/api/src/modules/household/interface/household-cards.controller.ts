import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdCardsService } from "../application/household-cards.service";
import { CreateHouseholdCardDto, UpdateHouseholdCardDto, UpdateHouseholdCardEntryDto } from "../application/dto/household-card.dto";

@UseGuards(JwtAuthGuard)
@Controller("household/cards")
export class HouseholdCardsController {
  constructor(private readonly service: HouseholdCardsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseholdCardDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateHouseholdCardDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  @Get("month/:year/:month")
  findMonth(
    @CurrentUser() user: AuthUser,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    return this.service.findMonth(user.userId, year, month);
  }

  @Patch("entries/:id")
  updateEntry(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateHouseholdCardEntryDto) {
    return this.service.updateEntry(user.userId, id, dto);
  }
}
