import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ProfitCalculatorService } from "./application/profit-calculator.service";
import { ProfitService } from "./application/profit.service";
import { ProfitController } from "./interface/profit.controller";

/** Módulo independente: não importa nenhum outro, como o CRM e a Academia. */
@Module({
  imports: [PrismaModule],
  controllers: [ProfitController],
  providers: [ProfitService, ProfitCalculatorService],
})
export class ProfitModule {}
