import { Module } from "@nestjs/common";
import { CardsController } from "./interface/cards.controller";
import { CardsService } from "./application/cards.service";
import { CardRepository } from "./domain/card.repository";
import { CardPrismaRepository } from "./infrastructure/card.prisma.repository";

@Module({
  controllers: [CardsController],
  providers: [CardsService, { provide: CardRepository, useClass: CardPrismaRepository }],
  exports: [CardRepository, CardsService],
})
export class CardsModule {}
