import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class TrackingHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const [items, total] = await Promise.all([
      this.prisma.trackingAuditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trackingAuditLog.count({ where: { userId } }),
    ]);

    return {
      items: items.map((l) => ({ id: l.id, entity: l.entity, action: l.action, before: l.before, after: l.after, createdAt: l.createdAt })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }
}
