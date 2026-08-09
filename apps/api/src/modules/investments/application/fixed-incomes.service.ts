import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InvestmentFixedIncome } from "@prisma/client";
import { FixedIncomeRepository } from "../domain/fixed-income.repository";
import { calculateFixedIncome, principalForTargetNetValue, splitContribution } from "../domain/fixed-income-calculator";
import { EconomicIndicatorCacheService } from "../infrastructure/economic-indicator-cache.service";
import { AddFixedIncomeInterestDto, CreateFixedIncomeDto, RedeemFixedIncomeDto, UpdateFixedIncomeDto } from "./dto/fixed-income.dto";

@Injectable()
export class FixedIncomesService {
  constructor(
    private readonly fixedIncomes: FixedIncomeRepository,
    private readonly indicators: EconomicIndicatorCacheService,
  ) {}

  async findAll(userId: string) {
    const rows = await this.fixedIncomes.findAllByUser(userId);
    return Promise.all(rows.map((row) => this.enrich(row)));
  }

  async findOne(userId: string, id: string) {
    const fixedIncome = await this.getOwned(userId, id);
    const [enriched, incomes] = await Promise.all([this.enrich(fixedIncome), this.fixedIncomes.listIncomes(id)]);
    return { ...enriched, incomeHistory: incomes };
  }

  async create(userId: string, dto: CreateFixedIncomeDto) {
    const fixedIncome = await this.fixedIncomes.create({
      userId,
      institution: dto.institution,
      type: dto.type,
      principalAmount: dto.principalAmount,
      applicationDate: new Date(dto.applicationDate),
      maturityDate: new Date(dto.maturityDate),
      liquidity: dto.liquidity,
      indexer: dto.indexer,
      fixedRatePercent: dto.fixedRatePercent,
      cdiPercent: dto.cdiPercent,
      notes: dto.notes,
    });
    return this.enrich(fixedIncome);
  }

  async update(userId: string, id: string, dto: UpdateFixedIncomeDto) {
    await this.getOwned(userId, id);
    // O DTO só deixa mexer em institution/notes, então principalAmount e contributedAmount não
    // saem de sincronia por aqui — quem os move é só o resgate parcial, que ajusta os dois juntos.
    const updated = await this.fixedIncomes.update(id, dto as Record<string, unknown>);
    return this.enrich(updated);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.fixedIncomes.softDelete(id);
    return { id };
  }

  /**
   * Marks the application as redeemed at a given date (today by default), locking in the net
   * value at that moment. `dto.amount` lets this be a partial redemption — and it means the net
   * cash the user actually wants to walk away with today (what lands in the bank account), not a
   * slice of the original principal. We back-solve how much principal needs to be split off so its
   * net value matches that target (calculateFixedIncome's net value is linear in principalAmount,
   * so this is a simple proportion — see principalForTargetNetValue). That slice becomes its own
   * application record, already resgatada, with the same terms/dates as the original; the original
   * keeps the remaining principal, still active and accruing.
   *
   * O principal e o dinheiro aportado se dividem por critérios diferentes, de propósito. O
   * principal é a base que rende juro, então a divisão tem que ser proporcional pro bruto/líquido
   * continuar fechando cent a cent: sacar R$ 2.000 líquidos de uma posição de R$ 10.048,27 consome
   * ~R$ 1.990 de base. Já o dinheiro aportado sai em regime de caixa — quem pôs R$ 10.000 e tirou
   * R$ 2.000 tem R$ 8.000 aplicados, que é o número redondo do extrato do banco. Guardar os dois
   * separados é o que faz a tela mostrar "Investido: R$ 8.000,00" em vez da base de rendimento.
   */
  async redeem(userId: string, id: string, dto: RedeemFixedIncomeDto) {
    const fixedIncome = await this.getOwned(userId, id);
    if (fixedIncome.redeemedAt) throw new BadRequestException("Essa aplicação já foi resgatada.");

    const redeemedAt = dto.redeemedAt ? new Date(dto.redeemedAt) : new Date();
    const principal = Number(fixedIncome.principalAmount);
    const fullCalc = await this.calculate(fixedIncome, redeemedAt);

    if (dto.amount === undefined) {
      const updated = await this.fixedIncomes.redeem(id, redeemedAt, fullCalc.netValue);
      return this.enrich(updated);
    }

    if (dto.amount > fullCalc.netValue) {
      throw new BadRequestException("O valor do resgate não pode ser maior que o valor líquido disponível agora.");
    }

    const requiredPrincipal = Math.round(principalForTargetNetValue(principal, fullCalc.netValue, dto.amount) * 100) / 100;

    if (requiredPrincipal >= principal) {
      const updated = await this.fixedIncomes.redeem(id, redeemedAt, fullCalc.netValue);
      return this.enrich(updated);
    }

    // Resgate parcial: a parte resgatada vira uma aplicação própria, já resgatada, com os mesmos
    // termos e datas da original — só o principal muda. A original continua ativa com o principal
    // reduzido, rendendo normalmente a partir de agora.
    const aporte = splitContribution(this.contributedOf(fixedIncome), dto.amount);

    const redeemedCalc = await this.calculate(fixedIncome, redeemedAt, requiredPrincipal);
    const redeemedCopy = await this.fixedIncomes.create({
      userId,
      institution: fixedIncome.institution,
      type: fixedIncome.type,
      principalAmount: requiredPrincipal,
      contributedAmount: aporte.withdrawn,
      applicationDate: fixedIncome.applicationDate,
      maturityDate: fixedIncome.maturityDate,
      liquidity: fixedIncome.liquidity,
      indexer: fixedIncome.indexer,
      fixedRatePercent: fixedIncome.fixedRatePercent ? Number(fixedIncome.fixedRatePercent) : undefined,
      cdiPercent: fixedIncome.cdiPercent ? Number(fixedIncome.cdiPercent) : undefined,
      notes: fixedIncome.notes ?? undefined,
    });
    await this.fixedIncomes.redeem(redeemedCopy.id, redeemedAt, redeemedCalc.netValue);

    const updatedOriginal = await this.fixedIncomes.update(id, {
      principalAmount: principal - requiredPrincipal,
      contributedAmount: aporte.remaining,
    });
    return this.enrich(updatedOriginal);
  }

  /** Reverts a redemption made by mistake — clears redeemedAt/redeemedNetAmount, making the
   *  application active again. Doesn't touch a sibling record created by a partial redemption
   *  (if any); undo that one separately if it was also wrong. */
  async unredeem(userId: string, id: string) {
    const fixedIncome = await this.getOwned(userId, id);
    if (!fixedIncome.redeemedAt) throw new BadRequestException("Essa aplicação não está resgatada.");
    const updated = await this.fixedIncomes.unredeem(id);
    return this.enrich(updated);
  }

  async addInterest(userId: string, id: string, dto: AddFixedIncomeInterestDto) {
    await this.getOwned(userId, id);
    return this.fixedIncomes.addIncome({
      userId,
      fixedIncomeId: id,
      type: dto.type ?? "JUROS",
      amount: dto.amount,
      paymentDate: new Date(dto.paymentDate),
      notes: dto.notes,
    });
  }

  private async enrich(fixedIncome: InvestmentFixedIncome) {
    const asOfDate = fixedIncome.redeemedAt ?? new Date();
    const calc = await this.calculate(fixedIncome, asOfDate);
    // contributedAmount vai resolvido no topo também (não só dentro de calculation) porque é o que
    // as telas e o dashboard mostram como "Investido" — ninguém deveria ter que lembrar do fallback.
    return { ...fixedIncome, contributedAmount: calc.contributedAmount, calculation: calc };
  }

  /** Aplicação que nunca sofreu resgate parcial tem a coluna nula, e aí o dinheiro aportado é o
   *  próprio principal — que é exatamente o que valia antes da coluna existir. */
  private contributedOf(fixedIncome: InvestmentFixedIncome): number {
    return fixedIncome.contributedAmount === null ? Number(fixedIncome.principalAmount) : Number(fixedIncome.contributedAmount);
  }

  /** `principalOverride` lets a caller price a hypothetical slice of the position (partial
   *  redemption) without needing a separate DB row first — same terms/dates, different amount. */
  private async calculate(fixedIncome: InvestmentFixedIncome, asOfDate: Date, principalOverride?: number) {
    const needsCdi = fixedIncome.indexer === "POS_FIXADO_CDI";
    const needsIpca = fixedIncome.indexer === "IPCA_MAIS";

    const [cdiAnnualRate, ipcaAnnualRate] = await Promise.all([
      needsCdi ? this.indicators.getAnnualCdiRate() : Promise.resolve(null),
      needsIpca ? this.indicators.getAnnualIpcaRate() : Promise.resolve(null),
    ]);

    return calculateFixedIncome({
      principalAmount: principalOverride ?? Number(fixedIncome.principalAmount),
      // Com principalOverride estamos precificando uma fatia hipotética que ainda não existe no
      // banco, então o aporte dela também não existe — cai no próprio override e o netGain sai
      // zero, que é o certo pra uma cotação de "quanto eu receberia".
      contributedAmount: principalOverride === undefined ? this.contributedOf(fixedIncome) : undefined,
      applicationDate: fixedIncome.applicationDate,
      asOfDate,
      type: fixedIncome.type,
      indexer: fixedIncome.indexer,
      fixedRatePercent: fixedIncome.fixedRatePercent ? Number(fixedIncome.fixedRatePercent) : null,
      cdiPercent: fixedIncome.cdiPercent ? Number(fixedIncome.cdiPercent) : null,
      cdiAnnualRate,
      ipcaAnnualRate,
    });
  }

  private async getOwned(userId: string, id: string) {
    const fixedIncome = await this.fixedIncomes.findById(id);
    if (!fixedIncome || fixedIncome.deletedAt) throw new NotFoundException("Aplicação não encontrada.");
    if (fixedIncome.userId !== userId) throw new ForbiddenException();
    return fixedIncome;
  }
}
