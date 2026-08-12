import { Module } from "@nestjs/common";
import { CrmAuditService } from "./application/crm-audit.service";
import { CrmCatalogService } from "./application/crm-catalog.service";
import { CrmCustomersService } from "./application/crm-customers.service";
import { CrmLeadsService } from "./application/crm-leads.service";
import { CrmResellersService } from "./application/crm-resellers.service";
import { CrmCatalogRepository } from "./domain/crm-catalog.repository";
import { CrmCatalogPrismaRepository } from "./infrastructure/crm-catalog.prisma.repository";
import { CrmCustomerRepository } from "./domain/crm-customer.repository";
import { CrmCustomerPrismaRepository } from "./infrastructure/crm-customer.prisma.repository";
import { CrmLeadRepository } from "./domain/crm-lead.repository";
import { CrmLeadPrismaRepository } from "./infrastructure/crm-lead.prisma.repository";
import { CrmResellerRepository } from "./domain/crm-reseller.repository";
import { CrmResellerPrismaRepository } from "./infrastructure/crm-reseller.prisma.repository";
import { CrmCatalogController } from "./interface/crm-catalog.controller";
import { CrmCustomersController } from "./interface/crm-customers.controller";
import { CrmLeadsController } from "./interface/crm-leads.controller";
import { CrmResellersController } from "./interface/crm-resellers.controller";

/**
 * CRM de clientes, assinaturas e revendedores.
 *
 * Sem `imports`: o módulo não depende de nenhum outro do app, e em particular não toca no Contas da
 * Casa. O único acoplamento é com a infraestrutura comum (Prisma, guard de auth), que é global.
 */
@Module({
  controllers: [CrmCatalogController, CrmCustomersController, CrmLeadsController, CrmResellersController],
  providers: [
    { provide: CrmCatalogRepository, useClass: CrmCatalogPrismaRepository },
    { provide: CrmCustomerRepository, useClass: CrmCustomerPrismaRepository },
    { provide: CrmLeadRepository, useClass: CrmLeadPrismaRepository },
    { provide: CrmResellerRepository, useClass: CrmResellerPrismaRepository },
    CrmCatalogService,
    CrmCustomersService,
    CrmLeadsService,
    CrmResellersService,
    CrmAuditService,
  ],
})
export class CrmModule {}
