import { Module } from "@nestjs/common";
import { TrackingModule } from "../tracking/tracking.module";
import { InvestmentsModule } from "../investments/investments.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";

@Module({
  imports: [TrackingModule, InvestmentsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
