import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTrackingJobData, TrackingJobRepository } from "../domain/tracking-job.repository";

@Injectable()
export class TrackingJobPrismaRepository extends TrackingJobRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.trackingJob.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });
  }

  findById(id: string) {
    return this.prisma.trackingJob.findUnique({ where: { id } });
  }

  create(data: CreateTrackingJobData) {
    return this.prisma.trackingJob.create({
      data: {
        userId: data.userId,
        type: data.type ?? "FIXO",
        name: data.name,
        company: data.company,
        client: data.client,
        monthlyValue: data.monthlyValue,
        totalAgreedValue: data.totalAgreedValue,
        currency: data.currency ?? "BRL",
        expectedHoursPerDay: data.expectedHoursPerDay ?? 8,
        startDate: data.startDate,
        endDate: data.endDate,
        paymentMethod: data.paymentMethod,
        paymentDay: data.paymentDay,
        color: data.color ?? "#7C3AED",
        weekdays: data.weekdays ?? [1, 2, 3, 4, 5],
        daysOff: data.daysOff ?? [],
        tracksPlacement: data.tracksPlacement ?? false,
        expectedStartTime: data.expectedStartTime,
        expectedEndTime: data.expectedEndTime,
        notes: data.notes,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.trackingJob.update({ where: { id }, data: data as any });
  }

  async softDelete(id: string) {
    await this.prisma.trackingJob.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
