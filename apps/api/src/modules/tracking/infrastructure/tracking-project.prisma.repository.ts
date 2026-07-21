import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTrackingProjectData, TrackingProjectRepository } from "../domain/tracking-project.repository";

@Injectable()
export class TrackingProjectPrismaRepository extends TrackingProjectRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.trackingProject.findMany({
      where: { userId, deletedAt: null },
      orderBy: { date: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.trackingProject.findUnique({ where: { id } });
  }

  create(data: CreateTrackingProjectData) {
    return this.prisma.trackingProject.create({
      data: {
        userId: data.userId,
        name: data.name,
        client: data.client,
        amountReceived: data.amountReceived,
        date: data.date,
        hoursSpent: data.hoursSpent,
        status: (data.status as any) ?? "CONCLUIDO",
        notes: data.notes,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.trackingProject.update({ where: { id }, data: data as any });
  }

  async softDelete(id: string) {
    await this.prisma.trackingProject.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
