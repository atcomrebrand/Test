import { Injectable } from "@nestjs/common";
import { EconomicIndicatorCacheService } from "../infrastructure/economic-indicator-cache.service";
import { FALLBACK_CDI_RATE, FALLBACK_IPCA_RATE, FALLBACK_SELIC_RATE } from "../infrastructure/providers/bacen.provider";
import { todayInBrazil } from "../domain/fixed-income-calculator";
import {
  ContributionSimulationInput,
  FixedIncomeSimulationInput,
  monthsToReach,
  poupancaAnnualRate,
  simulateContributions,
  simulateFixedIncome,
  SimulationRates,
} from "../domain/investment-simulator";

export type FixedIncomeSimulationRequest = Omit<FixedIncomeSimulationInput, "rates" | "today">;
export type ContributionSimulationRequest = ContributionSimulationInput & { target?: number | null };

/**
 * Simuladores da aba "Simular".
 *
 * As taxas vêm do mesmo cache do Bacen que a Renda Fixa usa — nada de o usuário digitar "quanto o
 * CDI está" e comparar com um número que não é o de hoje. `official: false` quando o Bacen não
 * respondeu e a conta caiu no valor de reserva: numa projeção de anos, um CDI errado vira milhares
 * de reais, e a tela precisa dizer isso.
 */
@Injectable()
export class SimulationsService {
  constructor(private readonly indicators: EconomicIndicatorCacheService) {}

  /** As taxas de hoje, e a da poupança derivada da Selic. A tela mostra pra deixar explícito em
   *  cima de que números a projeção foi feita. */
  async rates(): Promise<SimulationRates & { poupancaAnnual: number; official: boolean }> {
    const vindas = await this.indicators.getAnnualRatesOrNull().catch(() => ({ cdi: null, ipca: null, selic: null }));

    // `official` é a pergunta "projetei em cima do número do Bacen ou do valor de reserva?". Numa
    // projeção de anos a diferença entre 14,1% e 14,9% vira milhares de reais, então isso vai pra
    // tela — mesma regra do aviso âmbar da Renda Fixa.
    const official = vindas.cdi !== null && vindas.ipca !== null && vindas.selic !== null;
    const cdiAnnual = vindas.cdi ?? FALLBACK_CDI_RATE;
    const ipcaAnnual = vindas.ipca ?? FALLBACK_IPCA_RATE;
    const selicAnnual = vindas.selic ?? FALLBACK_SELIC_RATE;

    return { cdiAnnual, ipcaAnnual, selicAnnual, poupancaAnnual: poupancaAnnualRate(selicAnnual), official };
  }

  /**
   * O papel pedido, mais duas réguas ao lado: a poupança e um CDB de 100% do CDI.
   *
   * Simular um papel sozinho responde "quanto rende" e deixa de fora a pergunta que importa — "vale
   * a pena?". As duas comparações são o mínimo pra isso: a poupança é o chão que todo mundo
   * conhece, e 100% do CDI é o que qualquer banco grande paga sem negociar.
   */
  async fixedIncome(request: FixedIncomeSimulationRequest) {
    const rates = await this.rates();
    const today = todayInBrazil(new Date());
    const comum = { amount: request.amount, months: request.months, rates, today };

    return {
      rates,
      result: simulateFixedIncome({ ...request, rates, today }),
      benchmarks: [
        {
          label: "Poupança",
          // Poupança não paga IR e não é indexada ao CDI: entra como prefixado isento, que é
          // exatamente o comportamento dela.
          result: simulateFixedIncome({
            ...comum,
            type: "LCI",
            indexer: "PREFIXADO",
            fixedRatePercent: rates.poupancaAnnual,
          }),
        },
        {
          label: "CDB 100% do CDI",
          result: simulateFixedIncome({ ...comum, type: "CDB", indexer: "POS_FIXADO_CDI", cdiPercent: 100 }),
        },
      ],
    };
  }

  async contributions(request: ContributionSimulationRequest) {
    const { target, ...input } = request;
    return {
      ...simulateContributions(input),
      monthsToTarget: target && target > 0 ? monthsToReach(target, input) : null,
    };
  }
}
