import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrackingJobsController } from "./interface/tracking-jobs.controller";
import { TrackingSessionsController } from "./interface/tracking-sessions.controller";
import { TrackingIncomesController } from "./interface/tracking-incomes.controller";
import { TrackingDashboardController } from "./interface/tracking-dashboard.controller";
import { TrackingCalendarController } from "./interface/tracking-calendar.controller";
import { TrackingReportsController } from "./interface/tracking-reports.controller";
import { TrackingStatsController } from "./interface/tracking-stats.controller";
import { TrackingHistoryController } from "./interface/tracking-history.controller";
import { TrackingSearchController } from "./interface/tracking-search.controller";
import { TrackingExportController } from "./interface/tracking-export.controller";
import { TrackingJobPaymentsController } from "./interface/tracking-job-payments.controller";
import { TrackingJobsService } from "./application/tracking-jobs.service";
import { TrackingSessionsService } from "./application/tracking-sessions.service";
import { TrackingIncomesService } from "./application/tracking-incomes.service";
import { TrackingDashboardService } from "./application/tracking-dashboard.service";
import { TrackingCalendarService } from "./application/tracking-calendar.service";
import { TrackingReportsService } from "./application/tracking-reports.service";
import { TrackingStatsService } from "./application/tracking-stats.service";
import { TrackingHistoryService } from "./application/tracking-history.service";
import { TrackingSearchService } from "./application/tracking-search.service";
import { TrackingExportService } from "./application/tracking-export.service";
import { TrackingAuditService } from "./application/tracking-audit.service";
import { TrackingNotificationsService } from "./application/tracking-notifications.service";
import { TrackingFxService } from "./application/tracking-fx.service";
import { TrackingJobPaymentsService } from "./application/tracking-job-payments.service";
import { TrackingJobRepository } from "./domain/tracking-job.repository";
import { TrackingJobPrismaRepository } from "./infrastructure/tracking-job.prisma.repository";
import { TrackingSessionRepository } from "./domain/tracking-session.repository";
import { TrackingSessionPrismaRepository } from "./infrastructure/tracking-session.prisma.repository";
import { TrackingIncomeRepository } from "./domain/tracking-income.repository";
import { TrackingIncomePrismaRepository } from "./infrastructure/tracking-income.prisma.repository";
import { TrackingJobPaymentRepository } from "./domain/tracking-job-payment.repository";
import { TrackingJobPaymentPrismaRepository } from "./infrastructure/tracking-job-payment.prisma.repository";
import { TrackingFxRateProvider } from "./domain/tracking-fx.provider";
import { AwesomeApiFxProvider } from "./infrastructure/providers/awesomeapi-fx.provider";

@Module({
  imports: [NotificationsModule],
  controllers: [
    TrackingJobsController,
    TrackingSessionsController,
    TrackingIncomesController,
    TrackingDashboardController,
    TrackingCalendarController,
    TrackingReportsController,
    TrackingStatsController,
    TrackingHistoryController,
    TrackingSearchController,
    TrackingExportController,
    TrackingJobPaymentsController,
  ],
  providers: [
    TrackingJobsService,
    TrackingSessionsService,
    TrackingIncomesService,
    TrackingDashboardService,
    TrackingCalendarService,
    TrackingReportsService,
    TrackingStatsService,
    TrackingHistoryService,
    TrackingSearchService,
    TrackingExportService,
    TrackingAuditService,
    TrackingNotificationsService,
    TrackingFxService,
    TrackingJobPaymentsService,
    { provide: TrackingJobRepository, useClass: TrackingJobPrismaRepository },
    { provide: TrackingSessionRepository, useClass: TrackingSessionPrismaRepository },
    { provide: TrackingIncomeRepository, useClass: TrackingIncomePrismaRepository },
    { provide: TrackingJobPaymentRepository, useClass: TrackingJobPaymentPrismaRepository },
    { provide: TrackingFxRateProvider, useClass: AwesomeApiFxProvider },
  ],
  exports: [TrackingJobRepository, TrackingSessionRepository, TrackingIncomeRepository],
})
export class TrackingModule {}
