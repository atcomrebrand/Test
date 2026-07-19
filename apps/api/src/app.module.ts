import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CardsModule } from "./modules/cards/cards.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";
import { InstallmentsModule } from "./modules/installments/installments.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { StatisticsModule } from "./modules/statistics/statistics.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { TimelineModule } from "./modules/timeline/timeline.module";
import { SearchModule } from "./modules/search/search.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ExportModule } from "./modules/export/export.module";
import { AccountModule } from "./modules/account/account.module";
import { FinancingsModule } from "./modules/financings/financings.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    CardsModule,
    CategoriesModule,
    PurchasesModule,
    InstallmentsModule,
    DashboardModule,
    StatisticsModule,
    CalendarModule,
    TimelineModule,
    SearchModule,
    NotificationsModule,
    SettingsModule,
    ExportModule,
    AccountModule,
    FinancingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
