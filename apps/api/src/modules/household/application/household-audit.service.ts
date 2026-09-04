import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class HouseholdAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, entity: string, entityId: string, action: string, before: unknown, after: unknown) {
    await this.prisma.householdAuditLog.create({
      data: { userId, entity, entityId, action, before: before as any, after: after as any },
    });
  }
}
