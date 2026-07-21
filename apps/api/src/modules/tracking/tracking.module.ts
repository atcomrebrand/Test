import { Module } from "@nestjs/common";
import { TrackingJobsController } from "./interface/tracking-jobs.controller";
import { TrackingSessionsController } from "./interface/tracking-sessions.controller";
import { TrackingProjectsController } from "./interface/tracking-projects.controller";
import { TrackingIncomesController } from "./interface/tracking-incomes.controller";
import { TrackingDashboardController } from "./interface/tracking-dashboard.controller";
import { TrackingJobsService } from "./application/tracking-jobs.service";
import { TrackingSessionsService } from "./application/tracking-sessions.service";
import { TrackingProjectsService } from "./application/tracking-projects.service";
import { TrackingIncomesService } from "./application/tracking-incomes.service";
import { TrackingDashboardService } from "./application/tracking-dashboard.service";
import { TrackingAuditService } from "./application/tracking-audit.service";
import { TrackingJobRepository } from "./domain/tracking-job.repository";
import { TrackingJobPrismaRepository } from "./infrastructure/tracking-job.prisma.repository";
import { TrackingSessionRepository } from "./domain/tracking-session.repository";
import { TrackingSessionPrismaRepository } from "./infrastructure/tracking-session.prisma.repository";
import { TrackingProjectRepository } from "./domain/tracking-project.repository";
import { TrackingProjectPrismaRepository } from "./infrastructure/tracking-project.prisma.repository";
import { TrackingIncomeRepository } from "./domain/tracking-income.repository";
import { TrackingIncomePrismaRepository } from "./infrastructure/tracking-income.prisma.repository";

@Module({
  controllers: [
    TrackingJobsController,
    TrackingSessionsController,
    TrackingProjectsController,
    TrackingIncomesController,
    TrackingDashboardController,
  ],
  providers: [
    TrackingJobsService,
    TrackingSessionsService,
    TrackingProjectsService,
    TrackingIncomesService,
    TrackingDashboardService,
    TrackingAuditService,
    { provide: TrackingJobRepository, useClass: TrackingJobPrismaRepository },
    { provide: TrackingSessionRepository, useClass: TrackingSessionPrismaRepository },
    { provide: TrackingProjectRepository, useClass: TrackingProjectPrismaRepository },
    { provide: TrackingIncomeRepository, useClass: TrackingIncomePrismaRepository },
  ],
  exports: [TrackingJobRepository, TrackingSessionRepository, TrackingProjectRepository, TrackingIncomeRepository],
})
export class TrackingModule {}
