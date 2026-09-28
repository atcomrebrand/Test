import { cn } from "@/lib/cn";
import { CrmActivity, CrmCustomerStatus, CrmLeadStage, CrmResellerStatus } from "../types";

/**
 * Semântica de cor do §63: verde ativo/pago, amarelo atenção, vermelho atrasado, azul informação,
 * e o roxo/índigo reservado pro que é de revendedor. Uma cor por significado — status não empresta
 * a paleta de outra coisa.
 */
const CUSTOMER_TONE: Record<CrmCustomerStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  TRIAL: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  DUE_SOON: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LATE: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  DELINQUENT: "bg-red-500/10 text-red-600 dark:text-red-400",
  CANCELLED: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  INACTIVE: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  RECOVERY: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  LEAD: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const CUSTOMER_LABEL: Record<CrmCustomerStatus, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Teste",
  DUE_SOON: "Vencendo",
  LATE: "Em atraso",
  DELINQUENT: "Inadimplente",
  CANCELLED: "Cancelado",
  INACTIVE: "Inativo",
  RECOVERY: "Recuperação",
  LEAD: "Lead",
};

export function CustomerStatusBadge({ status, daysLate }: { status: CrmCustomerStatus; daysLate?: number }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium", CUSTOMER_TONE[status])}>
      {CUSTOMER_LABEL[status]}
      {/* O número de dias vai junto do rótulo: "em atraso" sozinho não diz se é urgente. */}
      {daysLate !== undefined && daysLate > 0 && ` · ${daysLate}d`}
    </span>
  );
}

const RESELLER_TONE: Record<CrmResellerStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  INACTIVE: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  SUSPENDED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  NEGOTIATING: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  BLOCKED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const RESELLER_LABEL: Record<CrmResellerStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
  NEGOTIATING: "Em negociação",
  BLOCKED: "Bloqueado",
};

export function ResellerStatusBadge({ status }: { status: CrmResellerStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium", RESELLER_TONE[status])}>
      {RESELLER_LABEL[status]}
    </span>
  );
}

const ACTIVITY_DOT: Record<CrmActivity, string> = {
  ACTIVE: "bg-emerald-500",
  ATTENTION: "bg-amber-500",
  INACTIVE: "bg-red-500",
};

const ACTIVITY_LABEL: Record<CrmActivity, string> = {
  ACTIVE: "Recarga recente",
  ATTENTION: "Sem recarga há um tempo",
  INACTIVE: "Parado",
};

/** Semáforo de atividade (§39). O texto acompanha a cor — cor sozinha não é acessível. */
export function ActivityDot({ activity, days }: { activity: CrmActivity; days?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={ACTIVITY_LABEL[activity]}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ACTIVITY_DOT[activity])} />
      {days === null || days === undefined ? "nunca recarregou" : `${days}d`}
    </span>
  );
}

const STAGE_LABEL: Record<CrmLeadStage, string> = {
  NEW: "Lead",
  CONTACTED: "Contato realizado",
  INTERESTED: "Interessado",
  TRIAL: "Teste",
  CONVERTED: "Cliente",
  LOST: "Perdido",
};

const STAGE_TONE: Record<CrmLeadStage, string> = {
  NEW: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  CONTACTED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  INTERESTED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  TRIAL: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  CONVERTED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  LOST: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function LeadStageBadge({ stage }: { stage: CrmLeadStage }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium", STAGE_TONE[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export { STAGE_LABEL, CUSTOMER_LABEL, RESELLER_LABEL };

/** Marca visual do serviço, pra listas em "Todos" não misturarem os dois sem aviso. */
export function PortfolioDot({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
