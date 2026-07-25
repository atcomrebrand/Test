import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrackingModule } from "../tracking/tracking.module";
import { HouseholdBillCategoriesController } from "./interface/household-bill-categories.controller";
import { HouseholdIncomeCategoriesController } from "./interface/household-income-categories.controller";
import { HouseholdBillsController } from "./interface/household-bills.controller";
import { HouseholdCardsController } from "./interface/household-cards.controller";
import { HouseholdIncomesController } from "./interface/household-incomes.controller";
import { HouseholdPresumedSalaryController } from "./interface/household-presumed-salary.controller";
import { HouseholdDashboardController } from "./interface/household-dashboard.controller";
import { HouseholdBillCategoriesService } from "./application/household-bill-categories.service";
import { HouseholdIncomeCategoriesService } from "./application/household-income-categories.service";
import { HouseholdBillsService } from "./application/household-bills.service";
import { HouseholdCardsService } from "./application/household-cards.service";
import { HouseholdIncomesService } from "./application/household-incomes.service";
import { HouseholdPresumedSalaryService } from "./application/household-presumed-salary.service";
import { HouseholdDashboardService } from "./application/household-dashboard.service";
import { HouseholdAuditService } from "./application/household-audit.service";
import { HouseholdBillRemindersService } from "./application/household-bill-reminders.service";
import { HouseholdMonthCompletionService } from "./application/household-month-completion.service";
import { HouseholdBillRepository } from "./domain/household-bill.repository";
import { HouseholdBillPrismaRepository } from "./infrastructure/household-bill.prisma.repository";
import { HouseholdBillEntryRepository } from "./domain/household-bill-entry.repository";
import { HouseholdBillEntryPrismaRepository } from "./infrastructure/household-bill-entry.prisma.repository";
import { HouseholdCardRepository } from "./domain/household-card.repository";
import { HouseholdCardPrismaRepository } from "./infrastructure/household-card.prisma.repository";
import { HouseholdCardEntryRepository } from "./domain/household-card-entry.repository";
import { HouseholdCardEntryPrismaRepository } from "./infrastructure/household-card-entry.prisma.repository";
import { HouseholdIncomeRepository } from "./domain/household-income.repository";
import { HouseholdIncomePrismaRepository } from "./infrastructure/household-income.prisma.repository";

@Module({
  imports: [NotificationsModule, TrackingModule],
  controllers: [
    HouseholdBillCategoriesController,
    HouseholdIncomeCategoriesController,
    HouseholdBillsController,
    HouseholdCardsController,
    HouseholdIncomesController,
    HouseholdPresumedSalaryController,
    HouseholdDashboardController,
  ],
  providers: [
    HouseholdBillCategoriesService,
    HouseholdIncomeCategoriesService,
    HouseholdBillsService,
    HouseholdCardsService,
    HouseholdIncomesService,
    HouseholdPresumedSalaryService,
    HouseholdDashboardService,
    HouseholdAuditService,
    HouseholdBillRemindersService,
    HouseholdMonthCompletionService,
    { provide: HouseholdBillRepository, useClass: HouseholdBillPrismaRepository },
    { provide: HouseholdBillEntryRepository, useClass: HouseholdBillEntryPrismaRepository },
    { provide: HouseholdCardRepository, useClass: HouseholdCardPrismaRepository },
    { provide: HouseholdCardEntryRepository, useClass: HouseholdCardEntryPrismaRepository },
    { provide: HouseholdIncomeRepository, useClass: HouseholdIncomePrismaRepository },
  ],
})
export class HouseholdModule {}
