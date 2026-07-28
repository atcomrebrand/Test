import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { CalendarModule } from "../calendar/calendar.module";
import { HouseholdModule } from "../household/household.module";
import { InvestmentsModule } from "../investments/investments.module";
import { TrackingModule } from "../tracking/tracking.module";
import { QuotesModule } from "../quotes/quotes.module";
import { AssistantController } from "./interface/assistant.controller";
import { AssistantService } from "./application/assistant.service";
import { ElevenLabsProvider } from "./infrastructure/elevenlabs.provider";

@Module({
  imports: [CardsModule, CalendarModule, HouseholdModule, InvestmentsModule, TrackingModule, QuotesModule],
  controllers: [AssistantController],
  providers: [AssistantService, ElevenLabsProvider],
})
export class AssistantModule {}
