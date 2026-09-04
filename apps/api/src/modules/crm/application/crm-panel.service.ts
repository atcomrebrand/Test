import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  averagePanelCreditPrice,
  checkCreditAvailability,
  CrmCurrency,
} from "../domain/panel-credits";
import { CrmAuditService } from "./crm-audit.service";
import { CrmCatalogService } from "./crm-catalog.service";

const MOVEMENT_KINDS = ["RECHARGE", "CONSUMPTION", "ADJUSTMENT"] as const;

export class CreatePanelRechargeDto {
  @IsString() portfolioId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  /** Preço pago por crédito, na moeda do serviço. */
  @Type(() => Number) @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreatePanelMovementDto {
  @IsString() portfolioId!: string;
  @IsEnum(MOVEMENT_KINDS) kind!: (typeof MOVEMENT_KINDS)[number];
  @Type(() => Number) @IsInt() quantity!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/**
 * Estoque próprio de créditos, por serviço.
 *
 * Fica separado de `CrmResellersService` de propósito: aquele controla o crédito que o revendedor
 * compra de você (receita), este controla o que você compra do painel de cima (custo). São dois
 * estoques que se movem em direções opostas na mesma operação — quando você repassa crédito pra um
 * revendedor, o dele sobe e o seu desce.
 */
@Injectable()
export class CrmPanelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CrmCatalogService,
    private readonly audit: CrmAuditService,
  ) {}

  /** Saldo de um serviço. Sempre a soma do extrato — não existe coluna de saldo. */
  async balance(userId: string, portfolioId: string): Promise<number> {
    const agg = await this.prisma.crmPanelCreditMovement.aggregate({
      where: { userId, portfolioId },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  /** Saldos de vários serviços numa consulta — a tela mostra todos lado a lado. */
  async balances(userId: string, portfolioIds: string[]): Promise<Map<string, number>> {
    if (portfolioIds.length === 0) return new Map();
    const rows = await this.prisma.crmPanelCreditMovement.groupBy({
      by: ["portfolioId"],
      where: { userId, portfolioId: { in: portfolioIds } },
      _sum: { quantity: true },
    });
    const map = new Map(portfolioIds.map((id) => [id, 0]));
    for (const r of rows) map.set(r.portfolioId, r._sum.quantity ?? 0);
    return map;
  }

  /** Preço médio ponderado pago por crédito, por serviço. Null quando nunca houve compra. */
  async averagePrices(userId: string, portfolioIds: string[]): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>(portfolioIds.map((id) => [id, null]));
    if (portfolioIds.length === 0) return map;

    const rows = await this.prisma.crmPanelRecharge.groupBy({
      by: ["portfolioId"],
      where: { userId, portfolioId: { in: portfolioIds } },
      _sum: { quantity: true, totalAmount: true },
    });

    for (const r of rows) {
      map.set(
        r.portfolioId,
        averagePanelCreditPrice([
          { quantity: r._sum.quantity ?? 0, totalAmount: Number(r._sum.totalAmount ?? 0) },
        ]),
      );
    }
    return map;
  }

  /** Visão completa de um serviço: saldo, custo médio, extrato e compras. */
  async overview(userId: string, portfolioId: string) {
    const portfolio = await this.catalog.assertPortfolio(userId, portfolioId);
    const [balance, prices, movements, recharges, settings, consumed] = await Promise.all([
      this.balance(userId, portfolioId),
      this.averagePrices(userId, [portfolioId]),
      this.prisma.crmPanelCreditMovement.findMany({
        where: { userId, portfolioId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.crmPanelRecharge.findMany({
        where: { userId, portfolioId },
        orderBy: { date: "desc" },
        take: 100,
      }),
      this.catalog.getSettings(userId),
      this.prisma.crmPanelCreditMovement.aggregate({
        where: { userId, portfolioId, quantity: { lt: 0 } },
        _sum: { quantity: true },
      }),
    ]);

    const averagePrice = prices.get(portfolioId) ?? null;
    const purchased = recharges.reduce((s, r) => s + r.quantity, 0);
    const totalSpent = recharges.reduce((s, r) => s + Number(r.totalAmount), 0);

    return {
      portfolio,
      currency: portfolio.currency as CrmCurrency,
      balance,
      averagePrice,
      purchased,
      used: -(consumed._sum.quantity ?? 0),
      totalSpent: Math.round(totalSpent * 100) / 100,
      /** Quanto o estoque parado ainda vale, ao preço médio pago. */
      stockValue: averagePrice !== null ? Math.round(balance * averagePrice * 100) / 100 : null,
      lowCredit: balance <= settings.panelLowCreditThreshold,
      threshold: settings.panelLowCreditThreshold,
      movements,
      recharges,
    };
  }

  /** Compra de créditos no painel de cima: grava a compra e credita o estoque, numa transação. */
  async recharge(userId: string, dto: CreatePanelRechargeDto) {
    const portfolio = await this.catalog.assertPortfolio(userId, dto.portfolioId);
    const totalAmount = Math.round(dto.unitPrice * dto.quantity * 100) / 100;

    const result = await this.prisma.$transaction(async (tx) => {
      const recharge = await tx.crmPanelRecharge.create({
        data: {
          userId,
          portfolioId: dto.portfolioId,
          date: dto.date ? new Date(dto.date) : new Date(),
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          totalAmount,
          // Congela a moeda vigente: trocar a moeda do serviço depois não reinterpreta o que foi pago.
          currency: portfolio.currency,
          notes: dto.notes ?? null,
        },
      });

      const movement = await tx.crmPanelCreditMovement.create({
        data: {
          userId,
          portfolioId: dto.portfolioId,
          kind: "RECHARGE",
          quantity: dto.quantity,
          panelRechargeId: recharge.id,
          note: `Compra de ${dto.quantity} créditos`,
        },
      });

      return { recharge, movement };
    });

    await this.audit.log(userId, "CrmPanelRecharge", result.recharge.id, "CREATE", null, result.recharge);
    return { ...result, balance: await this.balance(userId, dto.portfolioId) };
  }

  /** Ajuste manual — pra acertar o saldo com o painel real sem inventar uma compra. */
  async addMovement(userId: string, dto: CreatePanelMovementDto) {
    await this.catalog.assertPortfolio(userId, dto.portfolioId);
    if (dto.quantity === 0) throw new BadRequestException("Quantidade não pode ser zero");

    // Consumo sempre sai, compra sempre entra; só o ajuste respeita o sinal, porque é o tipo que
    // existe pra corrigir os outros dois nas duas direções.
    const signed =
      dto.kind === "CONSUMPTION"
        ? -Math.abs(dto.quantity)
        : dto.kind === "RECHARGE"
          ? Math.abs(dto.quantity)
          : dto.quantity;

    const movement = await this.prisma.crmPanelCreditMovement.create({
      data: { userId, portfolioId: dto.portfolioId, kind: dto.kind, quantity: signed, note: dto.note ?? null },
    });
    await this.audit.log(userId, "CrmPanelCreditMovement", movement.id, "CREATE", null, movement);
    return { movement, balance: await this.balance(userId, dto.portfolioId) };
  }

  /**
   * Confere se dá pra consumir antes de gravar qualquer coisa. Chamado pela renovação: a decisão do
   * usuário é bloquear, então é melhor descobrir aqui do que terminar com um saldo negativo que não
   * bate com o painel de verdade.
   */
  async assertCanConsume(userId: string, portfolioId: string, required: number) {
    const balance = await this.balance(userId, portfolioId);
    const check = checkCreditAvailability(balance, required);

    if (!check.enough) {
      throw new BadRequestException(
        `Créditos insuficientes: a renovação consome ${required} e o saldo é ${balance}. ` +
          `Faltam ${check.missing} — registre uma recarga do painel antes.`,
      );
    }
    return check;
  }

  /**
   * Debita dentro de uma transação já aberta. Recebe o `tx` porque o consumo tem que ser atômico
   * com a renovação: pagamento gravado sem baixa de crédito faria o saldo desviar do painel a cada
   * renovação, em silêncio.
   */
  consumeInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      portfolioId: string;
      quantity: number;
      subscriptionId?: string;
      customerId?: string;
      rechargeId?: string;
      note: string;
    },
  ) {
    return tx.crmPanelCreditMovement.create({
      data: {
        userId: data.userId,
        portfolioId: data.portfolioId,
        kind: "CONSUMPTION",
        quantity: -Math.abs(data.quantity),
        subscriptionId: data.subscriptionId ?? null,
        customerId: data.customerId ?? null,
        rechargeId: data.rechargeId ?? null,
        note: data.note,
      },
    });
  }

  /** Consumo do período, por serviço — alimenta o cálculo de lucro. */
  async consumedInPeriod(userId: string, portfolioIds: string[], from: Date, to: Date) {
    const map = new Map(portfolioIds.map((id) => [id, 0]));
    if (portfolioIds.length === 0) return map;

    const rows = await this.prisma.crmPanelCreditMovement.groupBy({
      by: ["portfolioId"],
      where: {
        userId,
        portfolioId: { in: portfolioIds },
        quantity: { lt: 0 },
        createdAt: { gte: from, lt: to },
      },
      _sum: { quantity: true },
    });

    for (const r of rows) map.set(r.portfolioId, -(r._sum.quantity ?? 0));
    return map;
  }
}
