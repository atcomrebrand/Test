import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Star, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCrmCustomers } from "../api";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { CustomerStatusBadge, PortfolioDot } from "../components/StatusBadge";
import { RenewButton, WhatsappButton } from "../components/QuickActions";

const FILTROS = [
  { value: "all", label: "Todos" },
  { value: "late", label: "Atrasados" },
  { value: "0", label: "Vencem hoje" },
  { value: "3", label: "Vencem em 3 dias" },
  { value: "7", label: "Vencem em 7 dias" },
  { value: "30", label: "Vencem em 30 dias" },
];

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("all");
  const [criando, setCriando] = useState(false);

  const { data: clientes, isLoading } = useCrmCustomers({
    search: busca.trim().length >= 2 ? busca.trim() : undefined,
    onlyLate: filtro === "late",
    dueWithinDays: /^\d+$/.test(filtro) ? Number(filtro) : undefined,
  });

  const total = clientes?.reduce((s, c) => s + Number(c.activeSubscription?.amount ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Clientes"
        description="Quem são, quando vencem e quanto geram."
        actions={
          <Button onClick={() => setCriando(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Nome, telefone ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select options={FILTROS} value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-48" />
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">{clientes?.length ?? 0} cliente(s)</p>
          <p className="text-lg font-bold">{formatCurrency(total)}/mês</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !clientes || clientes.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={busca || filtro !== "all" ? "Nenhum cliente nesse filtro" : "Nenhum cliente ainda"}
          description={
            busca || filtro !== "all"
              ? "Ajuste a busca ou o filtro."
              : "Cadastre o primeiro cliente pra começar a controlar vencimentos e renovações."
          }
          action={
            !busca && filtro === "all" ? <Button onClick={() => setCriando(true)}>Cadastrar cliente</Button> : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {clientes.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {c.vip && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                    <Link to={`/crm/clientes/${c.id}`} className="truncate text-sm font-medium hover:underline">
                      {c.nickname || c.name}
                    </Link>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <PortfolioDot name={c.portfolio.name} color={c.portfolio.color} />
                    {c.tenure && <span className="text-xs text-muted">· cliente há {c.tenure.label}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <CustomerStatusBadge status={c.status} daysLate={c.daysLate} />
                  {c.currentDueDate && (
                    <p className="mt-0.5 text-[11px] text-muted">{formatDate(c.currentDueDate)}</p>
                  )}
                </div>

                {c.activeSubscription && (
                  <span className="w-20 text-right font-semibold">{formatCurrency(c.activeSubscription.amount)}</span>
                )}

                <div className="flex items-center gap-1.5">
                  <WhatsappButton customerId={c.id} />
                  <RenewButton subscriptionId={c.activeSubscription?.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerFormModal open={criando} onClose={() => setCriando(false)} />
    </div>
  );
}
