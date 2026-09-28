import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import {
  useCreateCrmOrigin,
  useCreateCrmPaymentMethod,
  useCreateCrmPlan,
  useCrmOrigins,
  useCrmPaymentMethods,
  useCrmPlans,
  useCrmPortfolios,
  useCrmSettings,
  useUpdateCrmPaymentMethod,
  useUpdateCrmPlan,
  useUpdateCrmPortfolio,
  useUpdateCrmSettings,
} from "../api";

const PERIODOS = [
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

export default function Configuracoes() {
  const { data: portfolios } = useCrmPortfolios();
  const { data: plans } = useCrmPlans();
  const { data: methods } = useCrmPaymentMethods();
  const { data: origins } = useCrmOrigins();
  const { data: settings } = useCrmSettings();

  const updatePortfolio = useUpdateCrmPortfolio();
  const createPlan = useCreateCrmPlan();
  const updatePlan = useUpdateCrmPlan();
  const createMethod = useCreateCrmPaymentMethod();
  const updateMethod = useUpdateCrmPaymentMethod();
  const createOrigin = useCreateCrmOrigin();
  const updateSettings = useUpdateCrmSettings();

  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [novoPlano, setNovoPlano] = useState({ portfolioId: "", name: "", price: "", billingPeriod: "MONTHLY", creditCost: "1" });
  const [novaForma, setNovaForma] = useState({ name: "", feePercent: "0", feeFixed: "0" });
  const [novaOrigem, setNovaOrigem] = useState("");
  const [cfg, setCfg] = useState({
    panelLowCreditThreshold: "20",
    deductResellerRechargesFromPanel: true,
    vipMinMonths: "",
    vipMinRevenue: "",
    vipMinRenewals: "",
    resellerAttentionDays: "30",
    resellerInactiveDays: "60",
    defaultLowCreditThreshold: "10",
  });

  useEffect(() => {
    if (!settings) return;
    setCfg({
      panelLowCreditThreshold: String(settings.panelLowCreditThreshold),
      deductResellerRechargesFromPanel: settings.deductResellerRechargesFromPanel,
      vipMinMonths: settings.vipMinMonths?.toString() ?? "",
      vipMinRevenue: settings.vipMinRevenue ? String(Number(settings.vipMinRevenue)) : "",
      vipMinRenewals: settings.vipMinRenewals?.toString() ?? "",
      resellerAttentionDays: String(settings.resellerAttentionDays),
      resellerInactiveDays: String(settings.resellerInactiveDays),
      defaultLowCreditThreshold: String(settings.defaultLowCreditThreshold),
    });
  }, [settings]);

  if (!portfolios || !settings) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Nomes dos serviços, planos, taxas, origens e critérios." />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Serviços</h2>
        <div className="flex flex-col gap-2">
          {portfolios.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-end gap-3 py-3">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <Input
                  label="Nome do serviço"
                  value={nomes[p.id] ?? p.name}
                  onChange={(e) => setNomes({ ...nomes, [p.id]: e.target.value })}
                  className="min-w-[12rem] flex-1"
                />
                {/* A moeda vale pro serviço inteiro: o que é vendido em dólar é recebido em dólar e
                    tem o crédito comprado em dólar. */}
                <Select
                  label="Moeda"
                  value={p.currency}
                  onChange={(e) => updatePortfolio.mutate({ id: p.id, data: { currency: e.target.value } })}
                  options={[
                    { value: "BRL", label: "Real (R$)" },
                    { value: "USD", label: "Dólar (US$)" },
                  ]}
                  className="w-32"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={(nomes[p.id] ?? p.name) === p.name}
                  onClick={() => updatePortfolio.mutate({ id: p.id, data: { name: nomes[p.id] } })}
                >
                  Salvar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Planos</h2>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            {(plans ?? []).map((p) => {
              const servico = portfolios.find((x) => x.id === p.portfolioId);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {p.name} <span className="text-muted">· {servico?.name}</span>
                  </span>
                  <Input
                    label="Créditos"
                    type="number"
                    min="1"
                    defaultValue={String(p.creditCost)}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== p.creditCost) updatePlan.mutate({ id: p.id, data: { creditCost: v } });
                    }}
                    className="w-24"
                  />
                  <span className="w-24 text-right font-semibold">
                    {formatCurrency(p.price, servico?.currency ?? "BRL")}
                  </span>
                </div>
              );
            })}

            <div className="flex flex-wrap items-end gap-2 border-t border-[rgb(var(--border))] pt-3">
              <Select
                label="Serviço"
                value={novoPlano.portfolioId || portfolios[0].id}
                onChange={(e) => setNovoPlano({ ...novoPlano, portfolioId: e.target.value })}
                options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
                className="w-40"
              />
              <Input
                label="Nome"
                value={novoPlano.name}
                onChange={(e) => setNovoPlano({ ...novoPlano, name: e.target.value })}
                className="w-36"
              />
              <Input
                label="Preço"
                type="number"
                step="0.01"
                value={novoPlano.price}
                onChange={(e) => setNovoPlano({ ...novoPlano, price: e.target.value })}
                className="w-28"
              />
              <Input
                label="Créditos"
                type="number"
                min="1"
                value={novoPlano.creditCost}
                onChange={(e) => setNovoPlano({ ...novoPlano, creditCost: e.target.value })}
                className="w-24"
              />
              <Select
                label="Período"
                value={novoPlano.billingPeriod}
                onChange={(e) => setNovoPlano({ ...novoPlano, billingPeriod: e.target.value })}
                options={PERIODOS}
                className="w-32"
              />
              <Button
                size="sm"
                disabled={!novoPlano.name || !novoPlano.price}
                onClick={() =>
                  createPlan.mutate(
                    {
                      portfolioId: novoPlano.portfolioId || portfolios[0].id,
                      name: novoPlano.name,
                      price: Number(novoPlano.price),
                      billingPeriod: novoPlano.billingPeriod,
                      creditCost: Number(novoPlano.creditCost) || 1,
                    },
                    {
                      onSuccess: () =>
                        setNovoPlano({ portfolioId: "", name: "", price: "", billingPeriod: "MONTHLY", creditCost: "1" }),
                    },
                  )
                }
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Formas de pagamento</h2>
        {/* Alterar a taxa só vale daqui pra frente: pagamentos e recargas já gravados carregam a
            própria cópia, então o líquido do passado não se move (§36). */}
        <p className="mb-2 text-xs text-muted">
          Mudar a taxa vale só para os próximos lançamentos — o que já foi registrado guarda a taxa da época.
        </p>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            {(methods ?? []).map((m) => (
              <div key={m.id} className="flex flex-wrap items-end gap-2">
                <span className="min-w-[8rem] flex-1 text-sm">{m.name}</span>
                <Input
                  label="Taxa %"
                  type="number"
                  step="0.01"
                  defaultValue={String(Number(m.feePercent))}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== Number(m.feePercent)) updateMethod.mutate({ id: m.id, data: { feePercent: v } });
                  }}
                  className="w-24"
                />
                <Input
                  label="Taxa fixa"
                  type="number"
                  step="0.01"
                  defaultValue={String(Number(m.feeFixed))}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== Number(m.feeFixed)) updateMethod.mutate({ id: m.id, data: { feeFixed: v } });
                  }}
                  className="w-24"
                />
              </div>
            ))}

            <div className="flex flex-wrap items-end gap-2 border-t border-[rgb(var(--border))] pt-3">
              <Input
                label="Nova forma"
                value={novaForma.name}
                onChange={(e) => setNovaForma({ ...novaForma, name: e.target.value })}
                className="w-40"
              />
              <Input
                label="Taxa %"
                type="number"
                step="0.01"
                value={novaForma.feePercent}
                onChange={(e) => setNovaForma({ ...novaForma, feePercent: e.target.value })}
                className="w-24"
              />
              <Button
                size="sm"
                disabled={!novaForma.name}
                onClick={() =>
                  createMethod.mutate(
                    {
                      name: novaForma.name,
                      feePercent: Number(novaForma.feePercent),
                      feeFixed: Number(novaForma.feeFixed),
                    },
                    { onSuccess: () => setNovaForma({ name: "", feePercent: "0", feeFixed: "0" }) },
                  )
                }
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Origens</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 py-4">
            {(origins ?? []).map((o) => (
              <span key={o.id} className="surface-2 rounded-md px-2 py-1 text-xs">
                {o.name}
              </span>
            ))}
            <div className="flex w-full items-end gap-2 border-t border-[rgb(var(--border))] pt-3">
              <Input
                label="Nova origem"
                value={novaOrigem}
                onChange={(e) => setNovaOrigem(e.target.value)}
                className="w-48"
              />
              <Button
                size="sm"
                disabled={!novaOrigem}
                onClick={() => createOrigin.mutate(novaOrigem, { onSuccess: () => setNovaOrigem("") })}
              >
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Critérios</h2>
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div>
              <p className="mb-2 text-xs text-muted">
                VIP: basta bater <strong>um</strong> dos critérios. Deixe em branco pra desligar.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Meses como cliente"
                  type="number"
                  value={cfg.vipMinMonths}
                  onChange={(e) => setCfg({ ...cfg, vipMinMonths: e.target.value })}
                />
                <Input
                  label="Receita acima de"
                  type="number"
                  step="0.01"
                  value={cfg.vipMinRevenue}
                  onChange={(e) => setCfg({ ...cfg, vipMinRevenue: e.target.value })}
                />
                <Input
                  label="Renovações"
                  type="number"
                  value={cfg.vipMinRenewals}
                  onChange={(e) => setCfg({ ...cfg, vipMinRenewals: e.target.value })}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted">Semáforo do revendedor e alerta de saldo baixo.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Atenção após (dias)"
                  type="number"
                  value={cfg.resellerAttentionDays}
                  onChange={(e) => setCfg({ ...cfg, resellerAttentionDays: e.target.value })}
                />
                <Input
                  label="Inativo após (dias)"
                  type="number"
                  value={cfg.resellerInactiveDays}
                  onChange={(e) => setCfg({ ...cfg, resellerInactiveDays: e.target.value })}
                />
                <Input
                  label="Alerta de saldo ≤"
                  type="number"
                  value={cfg.defaultLowCreditThreshold}
                  onChange={(e) => setCfg({ ...cfg, defaultLowCreditThreshold: e.target.value })}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted">Seu estoque de créditos (o painel de cima).</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Avisar quando o painel tiver ≤"
                  type="number"
                  value={cfg.panelLowCreditThreshold}
                  onChange={(e) => setCfg({ ...cfg, panelLowCreditThreshold: e.target.value })}
                />
                <label className="flex items-start gap-2 pt-6 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.deductResellerRechargesFromPanel}
                    onChange={(e) => setCfg({ ...cfg, deductResellerRechargesFromPanel: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded"
                  />
                  {/* Ligado por padrão porque o sub-painel do revendedor costuma ser abastecido pelo
                      seu. Quem compra o painel dele à parte desliga aqui. */}
                  <span>
                    Repasse a revendedor sai do meu estoque
                    <span className="block text-xs text-muted">
                      Desligue se o painel do revendedor for comprado separado do seu.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <Button
              className="w-fit"
              loading={updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate({
                  panelLowCreditThreshold: Number(cfg.panelLowCreditThreshold),
                  deductResellerRechargesFromPanel: cfg.deductResellerRechargesFromPanel,
                  vipMinMonths: cfg.vipMinMonths ? Number(cfg.vipMinMonths) : null,
                  vipMinRevenue: cfg.vipMinRevenue ? Number(cfg.vipMinRevenue) : null,
                  vipMinRenewals: cfg.vipMinRenewals ? Number(cfg.vipMinRenewals) : null,
                  resellerAttentionDays: Number(cfg.resellerAttentionDays),
                  resellerInactiveDays: Number(cfg.resellerInactiveDays),
                  defaultLowCreditThreshold: Number(cfg.defaultLowCreditThreshold),
                })
              }
            >
              Salvar critérios
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
