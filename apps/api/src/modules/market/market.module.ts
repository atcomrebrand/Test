import { Module } from "@nestjs/common";
import { MarketImportService } from "./application/market-import.service";
import { MarketService } from "./application/market.service";
import { MarketRepository } from "./domain/market.repository";
import { MarketPrismaRepository } from "./infrastructure/market.prisma.repository";
import { SefazSpProvider } from "./infrastructure/providers/sefaz-sp.provider";
import { MarketController } from "./interface/market.controller";

@Module({
  controllers: [MarketController],
  providers: [{ provide: MarketRepository, useClass: MarketPrismaRepository }, MarketService, MarketImportService, SefazSpProvider],
  exports: [MarketService],
})
export class MarketModule {}
