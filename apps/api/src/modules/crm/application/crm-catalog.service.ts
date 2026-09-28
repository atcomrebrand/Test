import { Injectable, NotFoundException } from "@nestjs/common";
import { CrmCatalogRepository } from "../domain/crm-catalog.repository";
import { CrmAuditService } from "./crm-audit.service";
import {
  CreateCrmOriginDto,
  CreateCrmPaymentMethodDto,
  CreateCrmPlanDto,
  CreateCrmPortfolioDto,
  CreateCrmTagDto,
  CreateCrmTemplateDto,
  UpdateCrmOriginDto,
  UpdateCrmPaymentMethodDto,
  UpdateCrmPlanDto,
  UpdateCrmPortfolioDto,
  UpdateCrmSettingsDto,
  UpdateCrmTemplateDto,
} from "./dto/crm-catalog.dto";

/**
 * Cadastro base. Toda leitura por id passa por um `assert*` que filtra por userId — o `findFirst`
 * com `{ id, userId }` é o que impede pedir o plano de outra conta pelo id.
 */
@Injectable()
export class CrmCatalogService {
  constructor(
    private readonly repo: CrmCatalogRepository,
    private readonly audit: CrmAuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Portfólios
  // -------------------------------------------------------------------------

  /**
   * Semeia na primeira leitura em vez de exigir um passo de setup: o módulo abre já utilizável, com
   * os dois serviços, as formas de pagamento e os templates prontos.
   */
  async listPortfolios(userId: string) {
    const existing = await this.repo.listPortfolios(userId);
    if (existing.length > 0) return existing;
    return this.repo.seedDefaults(userId);
  }

  async assertPortfolio(userId: string, id: string) {
    const found = await this.repo.findPortfolio(userId, id);
    if (!found) throw new NotFoundException("Portfólio não encontrado");
    return found;
  }

  async createPortfolio(userId: string, dto: CreateCrmPortfolioDto) {
    const created = await this.repo.createPortfolio(userId, dto);
    await this.audit.log(userId, "CrmPortfolio", created.id, "CREATE", null, created);
    return created;
  }

  async updatePortfolio(userId: string, id: string, dto: UpdateCrmPortfolioDto) {
    const before = await this.assertPortfolio(userId, id);
    const after = await this.repo.updatePortfolio(id, dto);
    await this.audit.log(userId, "CrmPortfolio", id, "UPDATE", before, after);
    return after;
  }

  // -------------------------------------------------------------------------
  // Planos
  // -------------------------------------------------------------------------

  async listPlans(userId: string, portfolioId?: string) {
    if (portfolioId) await this.assertPortfolio(userId, portfolioId);
    return this.repo.listPlans(userId, portfolioId);
  }

  async assertPlan(userId: string, id: string) {
    const found = await this.repo.findPlan(userId, id);
    if (!found) throw new NotFoundException("Plano não encontrado");
    return found;
  }

  async createPlan(userId: string, dto: CreateCrmPlanDto) {
    await this.assertPortfolio(userId, dto.portfolioId);
    const created = await this.repo.createPlan(userId, dto);
    await this.audit.log(userId, "CrmPlan", created.id, "CREATE", null, created);
    return created;
  }

  async updatePlan(userId: string, id: string, dto: UpdateCrmPlanDto) {
    const before = await this.assertPlan(userId, id);
    const after = await this.repo.updatePlan(id, dto);
    await this.audit.log(userId, "CrmPlan", id, "UPDATE", before, after);
    return after;
  }

  async deletePlan(userId: string, id: string) {
    const before = await this.assertPlan(userId, id);
    await this.repo.deletePlan(id);
    await this.audit.log(userId, "CrmPlan", id, "DELETE", before, null);
    return { id };
  }

  // -------------------------------------------------------------------------
  // Formas de pagamento
  // -------------------------------------------------------------------------

  listPaymentMethods(userId: string) {
    return this.repo.listPaymentMethods(userId);
  }

  async assertPaymentMethod(userId: string, id: string) {
    const found = await this.repo.findPaymentMethod(userId, id);
    if (!found) throw new NotFoundException("Forma de pagamento não encontrada");
    return found;
  }

  async createPaymentMethod(userId: string, dto: CreateCrmPaymentMethodDto) {
    const created = await this.repo.createPaymentMethod(userId, dto);
    await this.audit.log(userId, "CrmPaymentMethod", created.id, "CREATE", null, created);
    return created;
  }

  /**
   * Alterar a taxa só vale daqui pra frente: pagamentos e recargas já gravados carregam a própria
   * cópia da taxa, então o líquido do passado não se move.
   */
  async updatePaymentMethod(userId: string, id: string, dto: UpdateCrmPaymentMethodDto) {
    const before = await this.assertPaymentMethod(userId, id);
    const after = await this.repo.updatePaymentMethod(id, dto);
    await this.audit.log(userId, "CrmPaymentMethod", id, "UPDATE", before, after);
    return after;
  }

  async deletePaymentMethod(userId: string, id: string) {
    const before = await this.assertPaymentMethod(userId, id);
    await this.repo.deletePaymentMethod(id);
    await this.audit.log(userId, "CrmPaymentMethod", id, "DELETE", before, null);
    return { id };
  }

  // -------------------------------------------------------------------------
  // Origens e tags
  // -------------------------------------------------------------------------

  listOrigins(userId: string) {
    return this.repo.listOrigins(userId);
  }

  async assertOrigin(userId: string, id: string) {
    const found = await this.repo.findOrigin(userId, id);
    if (!found) throw new NotFoundException("Origem não encontrada");
    return found;
  }

  createOrigin(userId: string, dto: CreateCrmOriginDto) {
    return this.repo.createOrigin(userId, dto.name);
  }

  async updateOrigin(userId: string, id: string, dto: UpdateCrmOriginDto) {
    await this.assertOrigin(userId, id);
    return this.repo.updateOrigin(id, dto);
  }

  async deleteOrigin(userId: string, id: string) {
    await this.assertOrigin(userId, id);
    await this.repo.deleteOrigin(id);
    return { id };
  }

  listTags(userId: string) {
    return this.repo.listTags(userId);
  }

  async assertTags(userId: string, ids: string[]) {
    for (const id of ids) {
      const found = await this.repo.findTag(userId, id);
      if (!found) throw new NotFoundException("Tag não encontrada");
    }
  }

  createTag(userId: string, dto: CreateCrmTagDto) {
    return this.repo.createTag(userId, dto);
  }

  async deleteTag(userId: string, id: string) {
    await this.assertTags(userId, [id]);
    await this.repo.deleteTag(id);
    return { id };
  }

  // -------------------------------------------------------------------------
  // Templates e configurações
  // -------------------------------------------------------------------------

  listTemplates(userId: string) {
    return this.repo.listTemplates(userId);
  }

  async assertTemplate(userId: string, id: string) {
    const found = await this.repo.findTemplate(userId, id);
    if (!found) throw new NotFoundException("Template não encontrado");
    return found;
  }

  createTemplate(userId: string, dto: CreateCrmTemplateDto) {
    return this.repo.createTemplate(userId, dto);
  }

  async updateTemplate(userId: string, id: string, dto: UpdateCrmTemplateDto) {
    await this.assertTemplate(userId, id);
    return this.repo.updateTemplate(id, dto);
  }

  async deleteTemplate(userId: string, id: string) {
    await this.assertTemplate(userId, id);
    await this.repo.deleteTemplate(id);
    return { id };
  }

  getSettings(userId: string) {
    return this.repo.getSettings(userId);
  }

  async updateSettings(userId: string, dto: UpdateCrmSettingsDto) {
    const before = await this.repo.getSettings(userId);
    const after = await this.repo.updateSettings(userId, dto as Record<string, unknown>);
    await this.audit.log(userId, "CrmSettings", after.id, "UPDATE", before, after);
    return after;
  }
}
