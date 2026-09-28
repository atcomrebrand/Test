import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Auditoria do CRM (§57). Registra o que mudou, nunca apaga.
 *
 * Vale pra alterações de cadastro e de status. Movimentação de crédito, pagamento e recarga não
 * passam por aqui porque já são, elas mesmas, o histórico — duplicá-las no log criaria duas versões
 * do mesmo fato.
 */
@Injectable()
export class CrmAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, entity: string, entityId: string, action: string, before: unknown, after: unknown) {
    await this.prisma.crmAuditLog.create({
      data: { userId, entity, entityId, action, before: before as never, after: after as never },
    });
  }

  list(userId: string, limit = 100) {
    return this.prisma.crmAuditLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  }
}
