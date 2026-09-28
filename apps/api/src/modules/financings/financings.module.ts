import { Module } from "@nestjs/common";
import { FinancingsController } from "./interface/financings.controller";
import { FinancingsService } from "./application/financings.service";
import { FinancingRepository } from "./domain/financing.repository";
import { FinancingPrismaRepository } from "./infrastructure/financing.prisma.repository";

@Module({
  controllers: [FinancingsController],
  providers: [FinancingsService, { provide: FinancingRepository, useClass: FinancingPrismaRepository }],
  exports: [FinancingRepository, FinancingsService],
})
export class FinancingsModule {}
