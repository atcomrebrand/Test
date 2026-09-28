import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdPresumedSalaryService } from "../application/household-presumed-salary.service";
import { UpsertHouseholdPresumedSalaryDto } from "../application/dto/household-presumed-salary.dto";

@UseGuards(JwtAuthGuard)
@Controller("household/presumed-salary")
export class HouseholdPresumedSalaryController {
  constructor(private readonly service: HouseholdPresumedSalaryService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.userId);
  }

  @Patch()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertHouseholdPresumedSalaryDto) {
    return this.service.upsert(user.userId, dto);
  }
}
