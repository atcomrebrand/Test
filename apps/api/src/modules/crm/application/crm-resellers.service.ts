import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  classifyResellerActivity,
  isLowCredit,
  signedQuantity,
  summarizeRecharges,
} from "../domain/credit-ledger";
import { CrmResellerRepository, ResellerFilters } from "../domain/crm-reseller.repository";
import { splitPaymentFee } from "../domain/revenue";
import { computeTenure, fullMonthsBetween } from "../domain/tenure";
import { CrmAuditService } from "./crm-audit.service";
import { CrmCatalogService } from "./crm-catalog.service";

const RESELLER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "NEGOTIATING", "BLOCKED"] as const;
const MOVEMENT_KINDS = ["RECHARGE", "USAGE", "ADJUSTMENT"] as const;

export class CreateCrmResellerDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) companyName?: string;
  @IsString() @MinLength(8) @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
  /** Vincula já a um serviço na criação — o caso normal. */
  @IsOptional() @IsString() portfolioId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) creditPrice?: number;
}

export class UpdateCrmResellerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) companyName?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
}

export class UpsertResellerLinkDto {
  @IsString() portfolioId!: string;
  @IsOptional() @IsEnum(RESELLER_STATUSES) status?: (typeof RESELLER_STATUSES)[number];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) creditPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowCreditThreshold?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateRechargeDto {
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  /** Quando omitido, usa o preço vigente do vínculo. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateMovementDto {
  @IsEnum(MOVEMENT_KINDS) kind!: (typeof MOVEMENT_KINDS)[number];
  @Type(() => Number) @IsInt() quantity!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateApproxClientsDto {
  @Type(() => Number) @IsInt() @Min(0) value!: number;
}

@Injectable()
export class CrmResellersService {
  constructor(
    private readonly repo: CrmResellerRepository,
    private readonly catalog: CrmCatalogService,
    private readonly audit: CrmAuditService,
  ) {}

  /**
   * Anexa saldo, semáforo e alerta a cada vínculo. Tudo derivado: o saldo vem das movimentações e a
   * atividade vem da data da última recarga, então nenhum dos dois pode divergir de um campo
   * guardado — porque não existe campo guardado.
   */
  private async decorate(rows: Awaited<ReturnType<CrmResellerRepository["list"]>>) {
    const linkIds = rows.flatMap((r) => r.portfolios.map((p) => p.id));
    const positions = await this.repo.creditPositions(rows[0]?.userId ?? "", linkIds);
    const byLink = new Map(positions.map((p) => [p.resellerPortfolioId, p]));

    const settings = rows.length ? await this.catalog.getSettings(rows[0].userId) : null;
    const now = new Date();

    return rows.map((reseller) => ({
      ...reseller,
      tags: reseller.tags.map((t) => t.tag),
      portfolios: reseller.portfolios.map((link) => {
        const pos = byLink.get(link.id) ?? {
          balance: 0,
          purchased: 0,
          used: 0,
          totalRecharges: 0,
          totalSpent: 0,
          lastRechargeAt: null,
        };
        const activity = classifyResellerActivity({
          lastRechargeAt: pos.lastRechargeAt,
          today: now,
          attentionDays: settings?.resellerAttentionDays ?? 30,
          inactiveDays: settings?.resellerInactiveDays ?? 60,
        });
        return {
          ...link,
          credits: pos,
          ...activity,
          lowCredit: isLowCredit({ balance: pos.balance, threshold: link.lowCreditThreshold }),
          tenure: computeTenure(link.startedAt, now),
        };
      }),
    }));
  }

  async list(userId: string, filters: ResellerFilters) {
    if (filters.portfolioId) await this.catalog.assertPortfolio(userId, filters.portfolioId);
    const rows = await this.repo.list(userId, filters);
    const decorated = await this.decorate(rows);

    if (!filters.onlyLowCredit) return decorated;
    // Filtro de saldo baixo é pós-consulta porque o saldo não existe como coluna — é a soma do
    // extrato, e comparar soma com o limite de cada vínculo no SQL exigiria uma view.
    return decorated
      .map((r) => ({ ...r, portfolios: r.portfolios.filter((p) => p.lowCredit) }))
      .filter((r) => r.portfolios.length > 0);
  }

  async assertOwned(userId: string, id: string) {
    const found = await this.repo.findById(userId, id);
    if (!found) throw new NotFoundException("Revendedor não encontrado");
    return found;
  }

  async assertLink(userId: string, id: string) {
    const found = await this.repo.findLink(userId, id);
    if (!found) throw new NotFoundException("Vínculo do revendedor não encontrado");
    return found;
  }

  async detail(userId: string, id: string) {
    const reseller = await this.assertOwned(userId, id);
    const [decorated] = await this.decorate([reseller]);

    // Métricas por vínculo (§38): média de recargas e preço médio pago, que só fazem sentido dentro
    // de um serviço — misturar os dois daria uma média que não existe na prática.
    const perLink = await Promise.all(
      reseller.portfolios.map(async (link) => {
        const [recharges, movements, priceChanges, approxChanges] = await Promise.all([
          this.repo.listRecharges(userId, link.id),
          this.repo.listMovements(userId, link.id),
          this.repo.listPriceChanges(userId, link.id),
          this.repo.listApproxChanges(userId, link.id),
        ]);

        const months = fullMonthsBetween(link.startedAt, new Date());
        const stats = summarizeRecharges(
          recharges.map((r) => ({ quantity: r.quantity, totalAmount: Number(r.totalAmount) })),
          months,
        );

        return { linkId: link.id, recharges, movements, priceChanges, approxChanges, stats };
      }),
    );

    return { ...decorated, details: perLink };
  }

  async create(userId: string, dto: CreateCrmResellerDto) {
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);
    if (dto.portfolioId) await this.catalog.assertPortfolio(userId, dto.portfolioId);

    const { tagIds, portfolioId, creditPrice, ...rest } = dto;
    const created = await this.repo.create(userId, rest, tagIds);

    if (portfolioId) {
      const settings = await this.catalog.getSettings(userId);
      await this.repo.createLink(userId, {
        resellerId: created.id,
        portfolioId,
        creditPrice: creditPrice ?? 0,
        lowCreditThreshold: settings.defaultLowCreditThreshold,
      });
    }

    await this.audit.log(userId, "CrmReseller", created.id, "CREATE", null, created);
    const full = await this.assertOwned(userId, created.id);
    return (await this.decorate([full]))[0];
  }

  async update(userId: string, id: string, dto: UpdateCrmResellerDto) {
    const before = await this.assertOwned(userId, id);
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);
    const { tagIds, ...rest } = dto;
    const after = await this.repo.update(id, rest, tagIds);
    await this.audit.log(userId, "CrmReseller", id, "UPDATE", before, after);
    return (await this.decorate([after]))[0];
  }

  async remove(userId: string, id: string) {
    const before = await this.assertOwned(userId, id);
    await this.repo.softDelete(id);
    await this.audit.log(userId, "CrmReseller", id, "DELETE", before, null);
    return { id };
  }

  /**
   * Cria ou atualiza o vínculo com um serviço. Um revendedor pode ter os dois, com créditos e
   * estimativas independentes (§45).
   */
  async upsertLink(userId: string, resellerId: string, dto: UpsertResellerLinkDto) {
    await this.assertOwned(userId, resellerId);
    await this.catalog.assertPortfolio(userId, dto.portfolioId);

    const existing = await this.repo.findLinkByPair(userId, resellerId, dto.portfolioId);
    if (!existing) {
      const settings = await this.catalog.getSettings(userId);
      return this.repo.createLink(userId, {
        resellerId,
        portfolioId: dto.portfolioId,
        status: dto.status ?? "ACTIVE",
        creditPrice: dto.creditPrice ?? 0,
        lowCreditThreshold: dto.lowCreditThreshold ?? settings.defaultLowCreditThreshold,
        notes: dto.notes ?? null,
      });
    }

    // Alteração de preço vira histórico (§36): recargas antigas guardam o próprio preço e não são
    // reprecificadas, então o histórico é a única forma de explicar a mudança depois.
    const data: Record<string, unknown> = { ...dto };
    delete data.portfolioId;

    if (dto.creditPrice !== undefined && Number(existing.creditPrice) !== dto.creditPrice) {
      await this.repo.recordPriceChange(userId, existing.id, Number(existing.creditPrice), dto.creditPrice);
    }

    return this.repo.updateLink(existing.id, data);
  }

  /** Recarga rápida (§41): quantidade e pronto — preço e forma de pagamento saem do vínculo. */
  async recharge(userId: string, linkId: string, dto: CreateRechargeDto) {
    const link = await this.assertLink(userId, linkId);
    const method = dto.paymentMethodId ? await this.catalog.assertPaymentMethod(userId, dto.paymentMethodId) : null;

    const unitPrice = dto.unitPrice ?? Number(link.creditPrice);
    if (unitPrice <= 0 && dto.unitPrice === undefined) {
      throw new BadRequestException("Defina o preço do crédito no vínculo antes de recarregar");
    }

    const totalAmount = Math.round(unitPrice * dto.quantity * 100) / 100;
    const fee = splitPaymentFee(totalAmount, {
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
    });

    const result = await this.repo.createRecharge({
      userId,
      resellerPortfolioId: linkId,
      portfolioId: link.portfolioId,
      date: dto.date ? new Date(dto.date) : new Date(),
      quantity: dto.quantity,
      unitPrice,
      totalAmount,
      paymentMethodId: dto.paymentMethodId ?? null,
      paymentMethodName: method?.name ?? null,
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
      feeAmount: fee.feeAmount,
      netAmount: fee.netAmount,
      notes: dto.notes ?? null,
    });

    await this.audit.log(userId, "CrmRecharge", result.recharge.id, "CREATE", null, result.recharge);

    const [position] = await this.repo.creditPositions(userId, [linkId]);
    return { ...result, balance: position?.balance ?? 0 };
  }

  /** Uso e ajuste. O sinal é imposto pelo tipo — a UI não consegue mandar uso positivo. */
  async addMovement(userId: string, linkId: string, dto: CreateMovementDto) {
    await this.assertLink(userId, linkId);
    const quantity = signedQuantity(dto.kind, dto.quantity);
    if (quantity === 0) throw new BadRequestException("Quantidade não pode ser zero");

    const movement = await this.repo.addMovement(userId, linkId, dto.kind, quantity, dto.note);
    const [position] = await this.repo.creditPositions(userId, [linkId]);
    await this.audit.log(userId, "CrmCreditMovement", movement.id, "CREATE", null, movement);
    return { movement, balance: position?.balance ?? 0 };
  }

  async statement(userId: string, linkId: string) {
    await this.assertLink(userId, linkId);
    const [movements, recharges, positions] = await Promise.all([
      this.repo.listMovements(userId, linkId),
      this.repo.listRecharges(userId, linkId),
      this.repo.creditPositions(userId, [linkId]),
    ]);
    return { movements, recharges, position: positions[0] ?? null };
  }

  /**
   * Estimativa de clientes ativos (§37). Guarda o valor anterior junto: o número é um chute
   * informado à mão, e sem o histórico não dá pra saber se ele subiu de verdade ou se alguém
   * corrigiu um erro de digitação.
   */
  async updateApproxClients(userId: string, linkId: string, dto: UpdateApproxClientsDto) {
    const link = await this.assertLink(userId, linkId);
    const previous = link.approxActiveClients;

    if (previous !== dto.value) {
      await this.repo.recordApproxChange(userId, linkId, previous, dto.value);
    }

    const after = await this.repo.updateLink(linkId, {
      approxActiveClients: dto.value,
      approxUpdatedAt: new Date(),
    });
    await this.audit.log(userId, "CrmResellerPortfolio", linkId, "UPDATE_APPROX", link, after);
    return after;
  }

  async priceHistory(userId: string, linkId: string) {
    await this.assertLink(userId, linkId);
    return this.repo.listPriceChanges(userId, linkId);
  }

  async approxHistory(userId: string, linkId: string) {
    await this.assertLink(userId, linkId);
    return this.repo.listApproxChanges(userId, linkId);
  }
}
