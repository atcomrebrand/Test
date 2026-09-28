import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { CardsService } from "../application/cards.service";
import { CreateCardDto, UpdateCardDto } from "../application/dto/card.dto";

@UseGuards(JwtAuthGuard)
@Controller("cards")
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  @Get(":id/usage")
  usage(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.usage(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCardDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCardDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
