import { Module } from "@nestjs/common";
import { TrackingModule } from "../tracking/tracking.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";

@Module({
  imports: [TrackingModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
