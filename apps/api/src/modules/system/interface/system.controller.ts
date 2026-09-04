import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { SystemMetricsService } from "../infrastructure/system-metrics.service";

/** Diagnóstico da máquina. Autenticado como todo o resto — não é informação secreta num app de uma
 *  pessoa só, mas também não é coisa pra ficar aberta na internet. */
@UseGuards(JwtAuthGuard)
@Controller("system")
export class SystemController {
  constructor(private readonly metrics: SystemMetricsService) {}

  @Get("health")
  health() {
    return this.metrics.health();
  }
}
