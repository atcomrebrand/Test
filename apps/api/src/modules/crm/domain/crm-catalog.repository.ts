import {
  CrmMessageTemplate,
  CrmOrigin,
  CrmPaymentMethod,
  CrmPlan,
  CrmPortfolio,
  CrmSettings,
  CrmTag,
} from "@prisma/client";

/**
 * Cadastro base do CRM: o que os clientes, leads e revendedores referenciam.
 *
 * Formas de pagamento, origens, tags e templates são globais ao usuário — PIX é o mesmo PIX nos
 * dois serviços, e duplicar por portfólio duplicaria a taxa, que é justamente o número que não pode
 * divergir. Planos são por portfólio, porque um plano é a oferta de um serviço específico.
 */

export interface UpsertPortfolioData {
  name: string;
  color?: string;
  order?: number;
  active?: boolean;
}

export interface UpsertPlanData {
  portfolioId: string;
  name: string;
  price: number;
  billingPeriod?: string;
  customDays?: number | null;
  active?: boolean;
  order?: number;
}

export interface UpsertPaymentMethodData {
  name: string;
  feePercent?: number;
  feeFixed?: number;
  active?: boolean;
  order?: number;
}

export interface UpsertTemplateData {
  name: string;
  category?: string;
  body: string;
  forReseller?: boolean;
  active?: boolean;
  order?: number;
}

export abstract class CrmCatalogRepository {
  abstract listPortfolios(userId: string): Promise<CrmPortfolio[]>;
  abstract findPortfolio(userId: string, id: string): Promise<CrmPortfolio | null>;
  abstract createPortfolio(userId: string, data: UpsertPortfolioData): Promise<CrmPortfolio>;
  abstract updatePortfolio(id: string, data: Partial<UpsertPortfolioData>): Promise<CrmPortfolio>;
  /** Cria os dois serviços e o cadastro base na primeira visita, numa transação. */
  abstract seedDefaults(userId: string): Promise<CrmPortfolio[]>;

  abstract listPlans(userId: string, portfolioId?: string): Promise<CrmPlan[]>;
  abstract findPlan(userId: string, id: string): Promise<CrmPlan | null>;
  abstract createPlan(userId: string, data: UpsertPlanData): Promise<CrmPlan>;
  abstract updatePlan(id: string, data: Partial<UpsertPlanData>): Promise<CrmPlan>;
  abstract deletePlan(id: string): Promise<void>;

  abstract listPaymentMethods(userId: string): Promise<CrmPaymentMethod[]>;
  abstract findPaymentMethod(userId: string, id: string): Promise<CrmPaymentMethod | null>;
  abstract createPaymentMethod(userId: string, data: UpsertPaymentMethodData): Promise<CrmPaymentMethod>;
  abstract updatePaymentMethod(id: string, data: Partial<UpsertPaymentMethodData>): Promise<CrmPaymentMethod>;
  abstract deletePaymentMethod(id: string): Promise<void>;

  abstract listOrigins(userId: string): Promise<CrmOrigin[]>;
  abstract findOrigin(userId: string, id: string): Promise<CrmOrigin | null>;
  abstract createOrigin(userId: string, name: string): Promise<CrmOrigin>;
  abstract updateOrigin(id: string, data: { name?: string; active?: boolean }): Promise<CrmOrigin>;
  abstract deleteOrigin(id: string): Promise<void>;

  abstract listTags(userId: string): Promise<CrmTag[]>;
  abstract findTag(userId: string, id: string): Promise<CrmTag | null>;
  abstract createTag(userId: string, data: { name: string; color?: string }): Promise<CrmTag>;
  abstract deleteTag(id: string): Promise<void>;

  abstract listTemplates(userId: string): Promise<CrmMessageTemplate[]>;
  abstract findTemplate(userId: string, id: string): Promise<CrmMessageTemplate | null>;
  abstract createTemplate(userId: string, data: UpsertTemplateData): Promise<CrmMessageTemplate>;
  abstract updateTemplate(id: string, data: Partial<UpsertTemplateData>): Promise<CrmMessageTemplate>;
  abstract deleteTemplate(id: string): Promise<void>;

  abstract getSettings(userId: string): Promise<CrmSettings>;
  abstract updateSettings(userId: string, data: Record<string, unknown>): Promise<CrmSettings>;
}
