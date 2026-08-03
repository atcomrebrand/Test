import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { FixedIncomesService } from "../application/fixed-incomes.service";
import { AddFixedIncomeInterestDto, CreateFixedIncomeDto, RedeemFixedIncomeDto, UpdateFixedIncomeDto } from "../application/dto/fixed-income.dto";

@UseGuards(JwtAuthGuard)
@Controller("investments/fixed-incomes")
export class FixedIncomesController {
  constructor(private readonly service: FixedIncomesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFixedIncomeDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateFixedIncomeDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  @Post(":id/redeem")
  redeem(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: RedeemFixedIncomeDto) {
    return this.service.redeem(user.userId, id, dto);
  }

  @Post(":id/unredeem")
  unredeem(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.unredeem(user.userId, id);
  }

  @Post(":id/interest")
  addInterest(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AddFixedIncomeInterestDto) {
    return this.service.addInterest(user.userId, id, dto);
  }
}
