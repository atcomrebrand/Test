import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { CalendarModule } from "../calendar/calendar.module";
import { HouseholdModule } from "../household/household.module";
import { InvestmentsModule } from "../investments/investments.module";
import { TrackingModule } from "../tracking/tracking.module";
import { AssistantController } from "./interface/assistant.controller";
import { AssistantService } from "./application/assistant.service";

@Module({
  imports: [CardsModule, CalendarModule, HouseholdModule, InvestmentsModule, TrackingModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
