import { Injectable } from "@nestjs/common";
import { TrackingSessionStatus } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTrackingSessionData, TrackingSessionRepository } from "../domain/tracking-session.repository";

const INCLUDE = { pauses: { orderBy: { pausedAt: "asc" as const } }, job: true };

@Injectable()
export class TrackingSessionPrismaRepository extends TrackingSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findActiveByUser(userId: string) {
    return this.prisma.trackingSession.findFirst({
      where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
      include: INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.trackingSession.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateTrackingSessionData) {
    return this.prisma.trackingSession.create({
      data: { userId: data.userId, jobId: data.jobId, checkIn: data.checkIn, notes: data.notes, status: "RUNNING" },
      include: INCLUDE,
    });
  }

  async addPause(sessionId: string, pausedAt: Date) {
    await this.prisma.trackingSessionPause.create({ data: { sessionId, pausedAt } });
  }

  async resumeLatestPause(sessionId: string, resumedAt: Date) {
    const openPause = await this.prisma.trackingSessionPause.findFirst({
      where: { sessionId, resumedAt: null },
      orderBy: { pausedAt: "desc" },
    });
    if (!openPause) return;
    await this.prisma.trackingSessionPause.update({ where: { id: openPause.id }, data: { resumedAt } });
  }

  async updateStatus(sessionId: string, status: TrackingSessionStatus) {
    await this.prisma.trackingSession.update({ where: { id: sessionId }, data: { status } });
  }

  finish(sessionId: string, checkOut: Date, notes?: string) {
    return this.prisma.trackingSession.update({
      where: { id: sessionId },
      data: { checkOut, status: "COMPLETED", ...(notes !== undefined ? { notes } : {}) },
      include: INCLUDE,
    });
  }

  updateManual(sessionId: string, data: { checkIn?: Date; checkOut?: Date; notes?: string }) {
    return this.prisma.trackingSession.update({ where: { id: sessionId }, data, include: INCLUDE });
  }

  findAllByUser(userId: string, range?: { from: Date; to: Date }) {
    return this.prisma.trackingSession.findMany({
      where: { userId, ...(range ? { checkIn: { gte: range.from, lte: range.to } } : {}) },
      include: INCLUDE,
      orderBy: { checkIn: "desc" },
    });
  }

  findRunningOlderThan(cutoff: Date) {
    return this.prisma.trackingSession.findMany({
      where: { status: { in: ["RUNNING", "PAUSED"] }, checkIn: { lt: cutoff } },
      include: INCLUDE,
    });
  }

  async delete(id: string) {
    await this.prisma.trackingSession.delete({ where: { id } });
  }
}
