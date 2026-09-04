import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { PortfolioEvolutionService } from "../application/portfolio-evolution.service";
import { EVOLUTION_RANGES, EvolutionRange } from "../domain/portfolio-evolution";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Range desconhecido cai em 12M em vez de 400: o parâmetro vem de um botão da tela, e um gráfico
 *  que não abre por causa de uma querystring é pior do que um gráfico no período padrão. */
function parseRange(value: string | undefined): EvolutionRange {
  const upper = (value ?? "").toUpperCase() as EvolutionRange;
  return EVOLUTION_RANGES.includes(upper) ? upper : "12M";
}

function parseDate(value: string | undefined): string | undefined {
  return value && ISO_DATE.test(value) ? value : undefined;
}

@UseGuards(JwtAuthGuard)
@Controller("investments/evolution")
export class PortfolioEvolutionController {
  constructor(private readonly service: PortfolioEvolutionService) {}

  @Get()
  evolution(
    @CurrentUser() user: AuthUser,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.evolution(user.userId, parseRange(range), parseDate(from), parseDate(to));
  }
}
