import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CrmLeadRepository, LeadFilters, LEAD_STAGES } from "../domain/crm-lead.repository";
import { CrmAuditService } from "./crm-audit.service";
import { CrmCatalogService } from "./crm-catalog.service";
import { CrmCustomersService } from "./crm-customers.service";

export class CreateCrmLeadDto {
  @IsString() portfolioId!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MinLength(8) @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() originId?: string;
  @IsOptional() @IsEnum(LEAD_STAGES as unknown as string[]) stage?: string;
  @IsOptional() @IsDateString() nextContactAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
}

export class UpdateCrmLeadDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() originId?: string;
  @IsOptional() @IsEnum(LEAD_STAGES as unknown as string[]) stage?: string;
  @IsOptional() @IsDateString() lastContactAt?: string;
  @IsOptional() @IsDateString() nextContactAt?: string;
  @IsOptional() @IsString() @MaxLength(500) lostReason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tagIds?: string[];
}

export class ConvertLeadDto {
  @IsOptional() @IsString() @MaxLength(60) nickname?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsDateString() trialEndsAt?: string;
}

@Injectable()
export class CrmLeadsService {
  constructor(
    private readonly repo: CrmLeadRepository,
    private readonly catalog: CrmCatalogService,
    private readonly customers: CrmCustomersService,
    private readonly audit: CrmAuditService,
  ) {}

  present(lead: Awaited<ReturnType<CrmLeadRepository["findById"]>>) {
    if (!lead) return null;
    return { ...lead, tags: lead.tags.map((t) => t.tag) };
  }

  async list(userId: string, filters: LeadFilters) {
    if (filters.portfolioId) await this.catalog.assertPortfolio(userId, filters.portfolioId);
    const rows = await this.repo.list(userId, filters);
    return rows.map((l) => ({ ...l, tags: l.tags.map((t) => t.tag) }));
  }

  async assertOwned(userId: string, id: string) {
    const found = await this.repo.findById(userId, id);
    if (!found) throw new NotFoundException("Lead não encontrado");
    return found;
  }

  async create(userId: string, dto: CreateCrmLeadDto) {
    await this.catalog.assertPortfolio(userId, dto.portfolioId);
    if (dto.originId) await this.catalog.assertOrigin(userId, dto.originId);
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);

    const { tagIds, nextContactAt, ...rest } = dto;
    const created = await this.repo.create(
      userId,
      { ...rest, nextContactAt: nextContactAt ? new Date(nextContactAt) : null },
      tagIds,
    );
    await this.audit.log(userId, "CrmLead", created.id, "CREATE", null, created);
    return this.present(created);
  }

  async update(userId: string, id: string, dto: UpdateCrmLeadDto) {
    const before = await this.assertOwned(userId, id);
    if (dto.originId) await this.catalog.assertOrigin(userId, dto.originId);
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);

    const { tagIds, lastContactAt, nextContactAt, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (lastContactAt !== undefined) data.lastContactAt = lastContactAt ? new Date(lastContactAt) : null;
    if (nextContactAt !== undefined) data.nextContactAt = nextContactAt ? new Date(nextContactAt) : null;

    const after = await this.repo.update(id, data, tagIds);
    await this.audit.log(userId, "CrmLead", id, "UPDATE", before, after);
    return this.present(after);
  }

  /**
   * Mover no funil também marca o contato: arrastar o card já é o registro de que houve interação,
   * e obrigar a preencher a data depois faria a informação simplesmente não existir.
   */
  async moveStage(userId: string, id: string, stage: string) {
    const before = await this.assertOwned(userId, id);
    if (before.convertedCustomerId && stage !== "CONVERTED") {
      throw new BadRequestException("Lead já convertido não volta pro funil");
    }
    const after = await this.repo.update(id, { stage, lastContactAt: new Date() });
    await this.audit.log(userId, "CrmLead", id, "MOVE_STAGE", before, after);
    return this.present(after);
  }

  /**
   * Conversão (§22): cria o cliente e mantém o lead, apontando um pro outro. Apagar o lead
   * destruiria a taxa de conversão por origem, que é justamente o que a conversão deveria alimentar.
   */
  async convert(userId: string, id: string, dto: ConvertLeadDto) {
    const lead = await this.assertOwned(userId, id);
    if (lead.convertedCustomerId) throw new BadRequestException("Lead já foi convertido");

    const customer = await this.customers.create(userId, {
      portfolioId: lead.portfolioId,
      name: lead.name,
      phone: lead.phone,
      whatsapp: lead.whatsapp ?? undefined,
      originId: lead.originId ?? undefined,
      nickname: dto.nickname,
      email: dto.email,
      trialEndsAt: dto.trialEndsAt,
    });

    const after = await this.repo.update(id, {
      stage: "CONVERTED",
      convertedCustomerId: customer.id,
      convertedAt: new Date(),
    });

    await this.audit.log(userId, "CrmLead", id, "CONVERT", lead, after);
    return { lead: this.present(after), customer };
  }

  async remove(userId: string, id: string) {
    const before = await this.assertOwned(userId, id);
    await this.repo.softDelete(id);
    await this.audit.log(userId, "CrmLead", id, "DELETE", before, null);
    return { id };
  }

  async stats(userId: string, portfolioId?: string) {
    if (portfolioId) await this.catalog.assertPortfolio(userId, portfolioId);
    return this.repo.conversionStats(userId, portfolioId);
  }
}
