import { Module } from "@nestjs/common";
import { DashboardModule } from "../dashboard/dashboard.module";
import { HouseholdModule } from "../household/household.module";
import { InvestmentsModule } from "../investments/investments.module";
import { TrackingModule } from "../tracking/tracking.module";
import { FinancingsModule } from "../financings/financings.module";
import { QuotesModule } from "../quotes/quotes.module";
import { HomeDashboardController } from "./interface/home-dashboard.controller";
import { HomeDashboardService } from "./application/home-dashboard.service";

@Module({
  imports: [DashboardModule, HouseholdModule, InvestmentsModule, TrackingModule, FinancingsModule, QuotesModule],
  controllers: [HomeDashboardController],
  providers: [HomeDashboardService],
  exports: [HomeDashboardService],
})
export class HomeModule {}
