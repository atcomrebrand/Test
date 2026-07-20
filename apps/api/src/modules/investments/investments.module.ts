import { Module } from "@nestjs/common";
import { StockQuoteProvider, CryptoQuoteProvider, EconomicIndicatorProvider } from "./domain/market-data.provider";
import { BrapiProvider } from "./infrastructure/providers/brapi.provider";
import { CoinGeckoProvider } from "./infrastructure/providers/coingecko.provider";
import { BacenProvider } from "./infrastructure/providers/bacen.provider";
import { MarketPriceService } from "./infrastructure/market-price.service";
import { EconomicIndicatorCacheService } from "./infrastructure/economic-indicator-cache.service";
import { FixedIncomeRepository } from "./domain/fixed-income.repository";
import { FixedIncomePrismaRepository } from "./infrastructure/fixed-income.prisma.repository";
import { FixedIncomesService } from "./application/fixed-incomes.service";
import { FixedIncomesController } from "./interface/fixed-incomes.controller";
import { AssetRepository } from "./domain/asset.repository";
import { AssetPrismaRepository } from "./infrastructure/asset.prisma.repository";
import { AssetsService } from "./application/assets.service";
import { AssetsController } from "./interface/assets.controller";
import { CashAccountRepository } from "./domain/cash-account.repository";
import { CashAccountPrismaRepository } from "./infrastructure/cash-account.prisma.repository";
import { CashAccountsService } from "./application/cash-accounts.service";
import { CashAccountsController } from "./interface/cash-accounts.controller";
import { InvestmentsDashboardService } from "./application/investments-dashboard.service";
import { InvestmentsDashboardController } from "./interface/investments-dashboard.controller";

@Module({
  controllers: [FixedIncomesController, AssetsController, CashAccountsController, InvestmentsDashboardController],
  providers: [
    { provide: StockQuoteProvider, useClass: BrapiProvider },
    { provide: CryptoQuoteProvider, useClass: CoinGeckoProvider },
    { provide: EconomicIndicatorProvider, useClass: BacenProvider },
    MarketPriceService,
    EconomicIndicatorCacheService,
    { provide: FixedIncomeRepository, useClass: FixedIncomePrismaRepository },
    FixedIncomesService,
    { provide: AssetRepository, useClass: AssetPrismaRepository },
    AssetsService,
    { provide: CashAccountRepository, useClass: CashAccountPrismaRepository },
    CashAccountsService,
    InvestmentsDashboardService,
  ],
  exports: [MarketPriceService, EconomicIndicatorCacheService, FixedIncomeRepository, AssetRepository, CashAccountRepository],
})
export class InvestmentsModule {}
