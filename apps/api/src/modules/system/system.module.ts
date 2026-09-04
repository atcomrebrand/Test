import { Module } from "@nestjs/common";
import { SystemMetricsService } from "./infrastructure/system-metrics.service";
import { SystemController } from "./interface/system.controller";

@Module({
  controllers: [SystemController],
  providers: [SystemMetricsService],
})
export class SystemModule {}
