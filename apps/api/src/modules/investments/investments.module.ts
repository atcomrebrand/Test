import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
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
import { CatalogCacheService } from "./infrastructure/catalog-cache.service";
import { CatalogController } from "./interface/catalog.controller";
import { MarketExplorerService } from "./application/market-explorer.service";
import { NewsProvider } from "./domain/news.provider";
import { GoogleNewsProvider } from "./infrastructure/providers/google-news.provider";
import { NewsCacheService } from "./infrastructure/news-cache.service";
import { ArticlePreviewService } from "./infrastructure/article-preview.service";
import { NewsService } from "./application/news.service";
import { NewsController } from "./interface/news.controller";
import { DividendsCacheService } from "./infrastructure/dividends-cache.service";
import { YahooDividendsProvider } from "./infrastructure/providers/yahoo-dividends.provider";
import { B3DividendsProvider } from "./infrastructure/providers/b3-dividends.provider";
import { FundamentusProvider } from "./infrastructure/providers/fundamentus.provider";
import { DividendsService } from "./application/dividends.service";
import { DividendsController } from "./interface/dividends.controller";
import { DividendAutoSyncService } from "./application/dividend-auto-sync.service";
import { DividendNotificationsService } from "./application/dividend-notifications.service";
import { B3ImportService } from "./application/b3-import.service";
import { B3ImportController } from "./interface/b3-import.controller";
import { LaunchesController } from "./interface/launches.controller";
import { InvestmentsResetService } from "./application/investments-reset.service";
import { InvestmentsResetController } from "./interface/investments-reset.controller";
import { AssetAnalysisService } from "./application/asset-analysis.service";
import { AssetHistoryService } from "./infrastructure/asset-history.service";
import { BenchmarkHistoryService } from "./infrastructure/benchmark-history.service";
import { PortfolioEvolutionService } from "./application/portfolio-evolution.service";
import { BenchmarkRecorderService } from "./application/benchmark-recorder.service";
import { PortfolioEvolutionController } from "./interface/portfolio-evolution.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [
    FixedIncomesController,
    AssetsController,
    CashAccountsController,
    InvestmentsDashboardController,
    CatalogController,
    NewsController,
    DividendsController,
    B3ImportController,
    LaunchesController,
    InvestmentsResetController,
    PortfolioEvolutionController,
  ],
  providers: [
    { provide: StockQuoteProvider, useClass: BrapiProvider },
    { provide: CryptoQuoteProvider, useClass: CoinGeckoProvider },
    { provide: EconomicIndicatorProvider, useClass: BacenProvider },
    { provide: NewsProvider, useClass: GoogleNewsProvider },
    MarketPriceService,
    EconomicIndicatorCacheService,
    CatalogCacheService,
    NewsCacheService,
    ArticlePreviewService,
    NewsService,
    DividendsCacheService,
    YahooDividendsProvider,
    FundamentusProvider,
    B3DividendsProvider,
    DividendsService,
    DividendAutoSyncService,
    DividendNotificationsService,
    B3ImportService,
    InvestmentsResetService,
    AssetHistoryService,
    BenchmarkHistoryService,
    PortfolioEvolutionService,
    BenchmarkRecorderService,
    { provide: FixedIncomeRepository, useClass: FixedIncomePrismaRepository },
    FixedIncomesService,
    { provide: AssetRepository, useClass: AssetPrismaRepository },
    AssetAnalysisService,
    AssetsService,
    { provide: CashAccountRepository, useClass: CashAccountPrismaRepository },
    CashAccountsService,
    InvestmentsDashboardService,
    MarketExplorerService,
  ],
  exports: [
    MarketPriceService,
    EconomicIndicatorCacheService,
    FixedIncomeRepository,
    AssetRepository,
    CashAccountRepository,
    InvestmentsDashboardService,
    MarketExplorerService,
    DividendsService,
  ],
})
export class InvestmentsModule {}
