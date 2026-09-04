import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Unlike InvestmentAuditLog (which only ever stores the new value), this always writes both
 * `before` and `after` — so the Histórico page can show a real diff for check-in/check-out edits
 * and value changes, not just "something changed". Callers are expected to fetch the entity
 * *before* mutating it and pass that snapshot in.
 */
@Injectable()
export class TrackingAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, entity: string, entityId: string, action: string, before: unknown, after: unknown) {
    await this.prisma.trackingAuditLog.create({
      data: { userId, entity, entityId, action, before: before as any, after: after as any },
    });
  }
}
