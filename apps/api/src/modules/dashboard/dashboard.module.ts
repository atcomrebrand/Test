import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { InstallmentsModule } from "../installments/installments.module";
import { PurchasesModule } from "../purchases/purchases.module";

@Module({
  imports: [InstallmentsModule, PurchasesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
