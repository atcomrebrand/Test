import { Module } from "@nestjs/common";
import { TrackingJobsController } from "./interface/tracking-jobs.controller";
import { TrackingSessionsController } from "./interface/tracking-sessions.controller";
import { TrackingJobsService } from "./application/tracking-jobs.service";
import { TrackingSessionsService } from "./application/tracking-sessions.service";
import { TrackingAuditService } from "./application/tracking-audit.service";
import { TrackingJobRepository } from "./domain/tracking-job.repository";
import { TrackingJobPrismaRepository } from "./infrastructure/tracking-job.prisma.repository";
import { TrackingSessionRepository } from "./domain/tracking-session.repository";
import { TrackingSessionPrismaRepository } from "./infrastructure/tracking-session.prisma.repository";

@Module({
  controllers: [TrackingJobsController, TrackingSessionsController],
  providers: [
    TrackingJobsService,
    TrackingSessionsService,
    TrackingAuditService,
    { provide: TrackingJobRepository, useClass: TrackingJobPrismaRepository },
    { provide: TrackingSessionRepository, useClass: TrackingSessionPrismaRepository },
  ],
  exports: [TrackingJobRepository, TrackingSessionRepository],
})
export class TrackingModule {}
