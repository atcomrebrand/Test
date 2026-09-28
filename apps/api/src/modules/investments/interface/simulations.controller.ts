import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { SimulationsService } from "../application/simulations.service";
import { SimulateContributionsDto, SimulateFixedIncomeDto } from "../application/dto/simulation.dto";

@UseGuards(JwtAuthGuard)
@Controller("investments/simulations")
export class SimulationsController {
  constructor(private readonly service: SimulationsService) {}

  @Get("rates")
  rates() {
    return this.service.rates();
  }

  // POST porque o corpo tem vários campos e a conta não é cacheável por URL — não é criação de nada.
  @Post("fixed-income")
  fixedIncome(@Body() dto: SimulateFixedIncomeDto) {
    return this.service.fixedIncome(dto);
  }

  @Post("contributions")
  contributions(@Body() dto: SimulateContributionsDto) {
    return this.service.contributions(dto);
  }
}
