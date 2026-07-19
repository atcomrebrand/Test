import { Module } from "@nestjs/common";
import { PurchasesController } from "./interface/purchases.controller";
import { PurchasesService } from "./application/purchases.service";
import { PurchaseRepository } from "./domain/purchase.repository";
import { PurchasePrismaRepository } from "./infrastructure/purchase.prisma.repository";
import { CardsModule } from "../cards/cards.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [CardsModule, NotificationsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, { provide: PurchaseRepository, useClass: PurchasePrismaRepository }],
  exports: [PurchaseRepository],
})
export class PurchasesModule {}
