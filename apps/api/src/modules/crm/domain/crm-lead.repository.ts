import { CrmLead, CrmOrigin, CrmPortfolio, CrmTag } from "@prisma/client";

export type LeadWithRelations = CrmLead & {
  portfolio: CrmPortfolio;
  origin: CrmOrigin | null;
  tags: { tag: CrmTag }[];
};

export type CrmLeadStage = "NEW" | "CONTACTED" | "INTERESTED" | "TRIAL" | "CONVERTED" | "LOST";

/** As etapas em ordem — a UI desenha o funil a partir daqui, então a ordem é a do domínio. */
export const LEAD_STAGES: readonly CrmLeadStage[] = ["NEW", "CONTACTED", "INTERESTED", "TRIAL", "CONVERTED", "LOST"];

export interface LeadFilters {
  portfolioId?: string;
  stage?: CrmLeadStage;
  originId?: string;
  search?: string;
}

export interface ConversionStats {
  total: number;
  converted: number;
  lost: number;
  /** Convertidos ÷ total, em %. Null sem leads — 0% diria que ninguém converteu. */
  conversionRate: number | null;
  /** Receita já gerada pelos clientes que vieram de lead. */
  convertedRevenue: number;
  byOrigin: { originId: string | null; originName: string; total: number; converted: number; rate: number | null }[];
  byStage: { stage: CrmLeadStage; count: number }[];
}

export abstract class CrmLeadRepository {
  abstract list(userId: string, filters: LeadFilters): Promise<LeadWithRelations[]>;
  abstract findById(userId: string, id: string): Promise<LeadWithRelations | null>;
  abstract create(userId: string, data: Record<string, unknown>, tagIds?: string[]): Promise<LeadWithRelations>;
  abstract update(id: string, data: Record<string, unknown>, tagIds?: string[]): Promise<LeadWithRelations>;
  abstract softDelete(id: string): Promise<void>;
  abstract conversionStats(userId: string, portfolioId?: string): Promise<ConversionStats>;
}
