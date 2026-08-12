import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useCrmStore } from "./store";
import {
  CrmComparison,
  CrmCurrencyBucket,
  CrmPanelBalance,
  CrmPanelOverview,
  CrmCustomer,
  CrmCustomerDetail,
  CrmDashboard,
  CrmDueCustomer,
  CrmFinancial,
  CrmLead,
  CrmLeadStats,
  CrmMessageTemplate,
  CrmOrigin,
  CrmPaymentMethod,
  CrmPlan,
  CrmPortfolio,
  CrmRenderedMessage,
  CrmReseller,
  CrmResellerDashboard,
  CrmResellerDetail,
  CrmRetentionPoint,
  CrmSearchResults,
  CrmSettings,
  CrmTag,
} from "./types";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["crm"] });
}

/** Monta a query string do portfólio. `null` = todos, e aí o parâmetro simplesmente não vai. */
function scope(portfolioId: string | null, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  if (portfolioId) params.set("portfolioId", portfolioId);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Hook de conveniência: quase toda tela do módulo precisa do portfólio selecionado. */
export function useCrmPortfolioId() {
  return useCrmStore((s) => s.portfolioId);
}

// ---------------------------------------------------------------------------
// Cadastro base
// ---------------------------------------------------------------------------

export function useCrmPortfolios() {
  return useQuery({
    queryKey: ["crm", "portfolios"],
    queryFn: () => api.get<CrmPortfolio[]>("/crm/portfolios"),
  });
}

export function useUpdateCrmPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmPortfolio>(`/crm/portfolios/${id}`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Serviço atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrmPlans(portfolioId?: string | null) {
  return useQuery({
    queryKey: ["crm", "plans", portfolioId],
    queryFn: () => api.get<CrmPlan[]>(`/crm/plans${scope(portfolioId ?? null)}`),
  });
}

export function useCreateCrmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmPlan>("/crm/plans", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Plano criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmPlan>(`/crm/plans/${id}`, data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCrmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crm/plans/${id}`),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrmPaymentMethods() {
  return useQuery({
    queryKey: ["crm", "payment-methods"],
    queryFn: () => api.get<CrmPaymentMethod[]>("/crm/payment-methods"),
  });
}

export function useCreateCrmPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmPaymentMethod>("/crm/payment-methods", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Forma de pagamento criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmPaymentMethod>(`/crm/payment-methods/${id}`, data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrmOrigins() {
  return useQuery({ queryKey: ["crm", "origins"], queryFn: () => api.get<CrmOrigin[]>("/crm/origins") });
}

export function useCreateCrmOrigin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<CrmOrigin>("/crm/origins", { name }),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrmTags() {
  return useQuery({ queryKey: ["crm", "tags"], queryFn: () => api.get<CrmTag[]>("/crm/tags") });
}

export function useCreateCrmTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.post<CrmTag>("/crm/tags", data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrmSettings() {
  return useQuery({ queryKey: ["crm", "settings"], queryFn: () => api.get<CrmSettings>("/crm/settings") });
}

export function useUpdateCrmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<CrmSettings>("/crm/settings", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Configurações salvas!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface CustomerListFilters {
  dueWithinDays?: number;
  onlyLate?: boolean;
  originId?: string;
  search?: string;
  tagIds?: string[];
}

export function useCrmCustomers(filters: CustomerListFilters = {}) {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "customers", portfolioId, filters],
    queryFn: () =>
      api.get<CrmCustomer[]>(
        `/crm/customers${scope(portfolioId, {
          dueWithinDays: filters.dueWithinDays !== undefined ? String(filters.dueWithinDays) : undefined,
          onlyLate: filters.onlyLate ? "true" : undefined,
          originId: filters.originId,
          search: filters.search,
          tagIds: filters.tagIds?.length ? filters.tagIds.join(",") : undefined,
        })}`,
      ),
  });
}

export function useCrmCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["crm", "customer", id],
    queryFn: () => api.get<CrmCustomerDetail>(`/crm/customers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCrmCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmCustomer>("/crm/customers", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Cliente cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmCustomer>(`/crm/customers/${id}`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Cliente atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCrmCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crm/customers/${id}`),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Cliente removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelCrmCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<CrmCustomer>(`/crm/customers/${id}/cancel`, { reason }),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Cliente cancelado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReactivateCrmCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<CrmCustomer>(`/crm/customers/${id}/reactivate`, {}),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Cliente reativado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCrmSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/subscriptions", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Assinatura criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/crm/subscriptions/${id}`, data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** A operação mais usada: corpo vazio herda tudo da assinatura. */
export function useRenewSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data = {} }: { id: string; data?: Record<string, unknown> }) =>
      api.post<{ nextDueDate: string; payment: { grossAmount: string } }>(`/crm/subscriptions/${id}/renew`, data),
    onSuccess: (res) => {
      invalidate(qc);
      const d = new Date(res.nextDueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      toast.success(`Renovado até ${d}!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCrmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/crm/payments", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Pagamento registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReversePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/crm/payments/${id}/reverse`, {}),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Pagamento estornado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function useCrmLeads(filters: { stage?: string; search?: string } = {}) {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "leads", portfolioId, filters],
    queryFn: () => api.get<CrmLead[]>(`/crm/leads${scope(portfolioId, filters)}`),
  });
}

export function useCrmLeadStats() {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "lead-stats", portfolioId],
    queryFn: () => api.get<CrmLeadStats>(`/crm/leads/stats${scope(portfolioId)}`),
  });
}

export function useCreateCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmLead>("/crm/leads", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Lead cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmLead>(`/crm/leads/${id}`, data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoveLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch<CrmLead>(`/crm/leads/${id}/stage`, { stage }),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data = {} }: { id: string; data?: Record<string, unknown> }) =>
      api.post<{ customer: CrmCustomer }>(`/crm/leads/${id}/convert`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Lead convertido em cliente!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crm/leads/${id}`),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Revendedores
// ---------------------------------------------------------------------------

export function useCrmResellers(filters: { status?: string; search?: string; onlyLowCredit?: boolean } = {}) {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "resellers", portfolioId, filters],
    queryFn: () =>
      api.get<CrmReseller[]>(
        `/crm/resellers${scope(portfolioId, {
          status: filters.status,
          search: filters.search,
          onlyLowCredit: filters.onlyLowCredit ? "true" : undefined,
        })}`,
      ),
  });
}

export function useCrmReseller(id: string | undefined) {
  return useQuery({
    queryKey: ["crm", "reseller", id],
    queryFn: () => api.get<CrmResellerDetail>(`/crm/resellers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCrmReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmReseller>("/crm/resellers", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Revendedor cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmReseller>(`/crm/resellers/${id}`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Revendedor atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCrmReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crm/resellers/${id}`),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Revendedor removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertResellerLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.post(`/crm/resellers/${id}/portfolios`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Vínculo salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: Record<string, unknown> }) =>
      api.post<{ balance: number; recharge: { quantity: number } }>(`/crm/resellers/links/${linkId}/recharges`, data),
    onSuccess: (res) => {
      invalidate(qc);
      toast.success(`+${res.recharge.quantity} créditos. Saldo: ${res.balance}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: Record<string, unknown> }) =>
      api.post<{ balance: number }>(`/crm/resellers/links/${linkId}/movements`, data),
    onSuccess: (res) => {
      invalidate(qc);
      toast.success(`Saldo atualizado: ${res.balance}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateApproxClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, value }: { linkId: string; value: number }) =>
      api.patch(`/crm/resellers/links/${linkId}/approx-clients`, { value }),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Estimativa atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

export function useCrmDashboard(period = "month") {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "dashboard", portfolioId, period],
    queryFn: () => api.get<CrmDashboard>(`/crm/dashboard${scope(portfolioId, { period })}`),
  });
}

export function useCrmFinancial(period: string, from?: string, to?: string) {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "financial", portfolioId, period, from, to],
    queryFn: () => api.get<CrmFinancial>(`/crm/dashboard/financial${scope(portfolioId, { period, from, to })}`),
  });
}

export function useCrmDueBoard() {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "due-board", portfolioId],
    queryFn: () => api.get<CrmDashboard["dueBoard"]>(`/crm/dashboard/due-board${scope(portfolioId)}`),
  });
}

export function useCrmResellerDashboard() {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "reseller-dashboard", portfolioId],
    queryFn: () => api.get<CrmResellerDashboard>(`/crm/dashboard/resellers${scope(portfolioId)}`),
  });
}

export function useCrmComparison() {
  return useQuery({
    queryKey: ["crm", "comparison"],
    queryFn: () => api.get<CrmComparison[]>("/crm/dashboard/comparison"),
  });
}

export function useCrmRetention() {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "retention", portfolioId],
    queryFn: () => api.get<CrmRetentionPoint[]>(`/crm/dashboard/retention${scope(portfolioId)}`),
  });
}

export function useCrmRetentionQueue() {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "retention-queue", portfolioId],
    queryFn: () =>
      api.get<(CrmDueCustomer & { vip: boolean; manualStatus: string | null })[]>(
        `/crm/dashboard/retention-queue${scope(portfolioId)}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Busca, templates e mensagens
// ---------------------------------------------------------------------------

export function useCrmSearch(term: string) {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "search", portfolioId, term],
    queryFn: () => api.get<CrmSearchResults>(`/crm/search${scope(portfolioId, { q: term })}`),
    enabled: term.trim().length >= 2,
  });
}

export function useCrmTemplates() {
  return useQuery({
    queryKey: ["crm", "templates"],
    queryFn: () => api.get<CrmMessageTemplate[]>("/crm/templates"),
  });
}

export function useCreateCrmTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CrmMessageTemplate>("/crm/templates", data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Template criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCrmTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<CrmMessageTemplate>(`/crm/templates/${id}`, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Template salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCrmTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/crm/templates/${id}`),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Renderiza a mensagem e abre o WhatsApp. O envio nunca é automático — esta função existe pra ser
 * chamada de um onClick, e o que ela faz é abrir a conversa com o texto pronto.
 */
export function useSendWhatsapp() {
  return useMutation({
    mutationFn: (body: { templateId: string; customerId?: string; linkId?: string }) =>
      api.post<CrmRenderedMessage>("/crm/messages/render", body),
    onSuccess: (res) => {
      if (!res.whatsappUrl) {
        toast.error("Sem telefone válido pra abrir o WhatsApp.");
        return;
      }
      if (res.missing.length > 0) {
        toast(`Faltou preencher: ${res.missing.join(", ")}`, { icon: "⚠️" });
      }
      window.open(res.whatsappUrl, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Estoque próprio de créditos (o painel de cima)
// ---------------------------------------------------------------------------

export function useCrmPanelBalances() {
  return useQuery({
    queryKey: ["crm", "panel", "balances"],
    queryFn: () => api.get<CrmPanelBalance[]>("/crm/panel/balances"),
  });
}

export function useCrmPanelOverview(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ["crm", "panel", portfolioId],
    queryFn: () => api.get<CrmPanelOverview>(`/crm/panel/${portfolioId}`),
    enabled: Boolean(portfolioId),
  });
}

export function useCreatePanelRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ balance: number; recharge: { quantity: number } }>("/crm/panel/recharges", data),
    onSuccess: (res) => {
      invalidate(qc);
      toast.success(`+${res.recharge.quantity} créditos. Saldo: ${res.balance}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePanelMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ balance: number }>("/crm/panel/movements", data),
    onSuccess: (res) => {
      invalidate(qc);
      toast.success(`Saldo do painel: ${res.balance}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Receita e lucro por moeda — nunca um total único misturando real com dólar. */
export function useCrmByCurrency(period = "month") {
  const portfolioId = useCrmPortfolioId();
  return useQuery({
    queryKey: ["crm", "by-currency", portfolioId, period],
    queryFn: () =>
      api.get<{ byCurrency: CrmCurrencyBucket[] }>(`/crm/dashboard/by-currency${scope(portfolioId, { period })}`),
  });
}
