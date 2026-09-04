import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useConvertLead,
  useCreateCrmLead,
  useCrmLeadStats,
  useCrmLeads,
  useCrmOrigins,
  useCrmPortfolioId,
  useCrmPortfolios,
  useMoveLeadStage,
} from "../api";
import { LeadStageBadge, PortfolioDot, STAGE_LABEL } from "../components/StatusBadge";
import { WhatsappButton } from "../components/QuickActions";
import { CrmLeadStage } from "../types";

/** A ordem do funil (§21). CONVERTED e LOST são destinos, não etapas de trabalho. */
const FUNIL: CrmLeadStage[] = ["NEW", "CONTACTED", "INTERESTED", "TRIAL"];
const PROXIMA: Record<string, CrmLeadStage> = {
  NEW: "CONTACTED",
  CONTACTED: "INTERESTED",
  INTERESTED: "TRIAL",
};

function NovoLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: portfolios } = useCrmPortfolios();
  const { data: origins } = useCrmOrigins();
  const selected = useCrmPortfolioId();
  const create = useCreateCrmLead();
  const [form, setForm] = useState({ name: "", phone: "", originId: "", portfolioId: "" });

  const portfolioId = form.portfolioId || selected || portfolios?.[0]?.id || "";

  return (
    <Modal open={open} onClose={onClose} title="Novo lead">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            {
              portfolioId,
              name: form.name.trim(),
              phone: form.phone.trim(),
              originId: form.originId || undefined,
            },
            {
              onSuccess: () => {
                setForm({ name: "", phone: "", originId: "", portfolioId: "" });
                onClose();
              },
            },
          );
        }}
        className="flex flex-col gap-3"
      >
        <Select
          label="Serviço"
          value={portfolioId}
          onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}
          options={(portfolios ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input
          label="Telefone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <Select
          label="Origem"
          value={form.originId}
          onChange={(e) => setForm({ ...form, originId: e.target.value })}
          options={[{ value: "", label: "Sem origem" }, ...(origins ?? []).map((o) => ({ value: o.id, label: o.name }))]}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Cadastrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Leads() {
  const { data: leads, isLoading } = useCrmLeads();
  const { data: stats } = useCrmLeadStats();
  const move = useMoveLeadStage();
  const convert = useConvertLead();
  const [criando, setCriando] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leads"
        description="Quem chegou, em que etapa está e quanto vira cliente."
        actions={
          <Button onClick={() => setCriando(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo lead
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Total de leads</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Convertidos</p>
            <p className="text-xl font-bold text-emerald-500">{stats.converted}</p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Taxa de conversão</p>
            <p className="text-xl font-bold">{stats.conversionRate !== null ? `${stats.conversionRate}%` : "—"}</p>
          </div>
          <div className="surface rounded-xl border border-[rgb(var(--border))] p-3">
            <p className="text-xs text-muted">Receita dos convertidos</p>
            <p className="text-xl font-bold">{formatCurrency(stats.convertedRevenue)}</p>
          </div>
        </div>
      )}

      {/* Funil visual: uma coluna por etapa, com o card movendo pra próxima num clique (§21). */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !leads || leads.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Nenhum lead ainda"
          description="Cadastre quem entrou em contato pra acompanhar até virar cliente."
          action={<Button onClick={() => setCriando(true)}>Cadastrar lead</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {FUNIL.map((stage) => {
            const doStage = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-semibold">{STAGE_LABEL[stage]}</p>
                  <span className="text-xs text-muted">{doStage.length}</span>
                </div>
                {doStage.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[rgb(var(--border))] p-4 text-center text-xs text-muted">
                    vazio
                  </div>
                ) : (
                  doStage.map((l) => (
                    <Card key={l.id}>
                      <CardContent className="flex flex-col gap-2 py-3">
                        <div>
                          <p className="text-sm font-medium">{l.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <PortfolioDot name={l.portfolio.name} color={l.portfolio.color} />
                            {l.origin && <span className="text-xs text-muted">· {l.origin.name}</span>}
                          </div>
                          {l.lastContactAt && (
                            <p className="mt-0.5 text-[11px] text-muted">
                              último contato {formatDate(l.lastContactAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <WhatsappButton customerId={undefined} categories={["WELCOME", "SUPPORT"]} />
                          {PROXIMA[stage] && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => move.mutate({ id: l.id, stage: PROXIMA[stage] })}
                            >
                              → {STAGE_LABEL[PROXIMA[stage]]}
                            </Button>
                          )}
                          <Button size="sm" onClick={() => convert.mutate({ id: l.id })} loading={convert.isPending}>
                            Virou cliente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {stats && stats.byOrigin.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Conversão por origem</h2>
          <Card>
            <CardContent className="flex flex-col divide-y divide-[rgb(var(--border))] py-0">
              {stats.byOrigin.map((o) => (
                <div key={o.originId ?? "none"} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{o.originName}</span>
                  <span className="text-sm text-muted">
                    {o.converted}/{o.total}
                  </span>
                  <span className="w-14 text-right font-semibold">{o.rate !== null ? `${o.rate}%` : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <NovoLeadModal open={criando} onClose={() => setCriando(false)} />
    </div>
  );
}
