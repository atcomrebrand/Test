import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus, Search, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCrmResellers } from "../api";
import { RechargeModal } from "../components/RechargeModal";
import { ResellerFormModal } from "../components/ResellerFormModal";
import { ActivityDot, PortfolioDot, ResellerStatusBadge } from "../components/StatusBadge";
import { RechargeButton, WhatsappButton } from "../components/QuickActions";

const STATUS = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativos" },
  { value: "NEGOTIATING", label: "Em negociação" },
  { value: "SUSPENDED", label: "Suspensos" },
  { value: "BLOCKED", label: "Bloqueados" },
  { value: "INACTIVE", label: "Inativos" },
];

export default function Revendedores() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [soBaixo, setSoBaixo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [recarregando, setRecarregando] = useState<{ linkId: string; nome: string; preco: number } | null>(null);

  const { data: resellers, isLoading } = useCrmResellers({
    search: busca.trim().length >= 2 ? busca.trim() : undefined,
    status: status || undefined,
    onlyLowCredit: soBaixo,
  });

  // Uma linha por vínculo, não por pessoa: crédito e estimativa são por serviço, e juntar os dois
  // numa linha só somaria números que não se somam (§45).
  const linhas = (resellers ?? []).flatMap((r) => r.portfolios.map((p) => ({ reseller: r, link: p })));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Revendedores"
        description="Créditos, recargas e quanto cada um movimenta — separado por serviço."
        actions={
          <Button onClick={() => setCriando(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo revendedor
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Nome, empresa ou telefone…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select options={STATUS} value={status} onChange={(e) => setStatus(e.target.value)} className="w-48" />
        <Button
          variant={soBaixo ? "primary" : "outline"}
          onClick={() => setSoBaixo((v) => !v)}
          className="gap-1.5"
        >
          <AlertTriangle className="h-4 w-4" /> Saldo baixo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title={soBaixo ? "Nenhum revendedor com saldo baixo" : "Nenhum revendedor ainda"}
          description={
            soBaixo
              ? "Todo mundo está acima do limite configurado."
              : "Cadastre um revendedor pra controlar créditos, recargas e quanto ele movimenta."
          }
          action={!soBaixo ? <Button onClick={() => setCriando(true)}>Cadastrar revendedor</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {linhas.map(({ reseller, link }) => (
            <Card key={link.id} className={cn(link.lowCredit && "border-l-4 border-l-amber-500")}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/crm/revendedores/${reseller.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {reseller.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <PortfolioDot name={link.portfolio.name} color={link.portfolio.color} />
                    <ActivityDot activity={link.activity} days={link.daysSinceLastRecharge} />
                  </div>
                </div>

                <ResellerStatusBadge status={link.status} />

                <div className="text-right">
                  <p
                    className={cn(
                      "text-lg font-bold",
                      link.lowCredit ? "text-amber-500" : "text-violet-600 dark:text-violet-400",
                    )}
                  >
                    {link.credits.balance}
                  </p>
                  <p className="text-[11px] text-muted">créditos</p>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold">{formatCurrency(link.credits.totalSpent)}</p>
                  <p className="text-[11px] text-muted">{link.credits.totalRecharges} recarga(s)</p>
                </div>

                <div className="hidden text-right md:block">
                  {/* Sempre "~" e sempre rotulado: é estimativa informada à mão (§37). */}
                  <p className="text-sm font-semibold">~{link.approxActiveClients}</p>
                  <p className="text-[11px] text-muted">clientes (estim.)</p>
                </div>

                <div className="hidden text-right lg:block">
                  <p className="text-xs text-muted">
                    {link.credits.lastRechargeAt ? formatDate(link.credits.lastRechargeAt) : "nunca"}
                  </p>
                  <p className="text-[11px] text-muted">última recarga</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <WhatsappButton linkId={link.id} />
                  <RechargeButton
                    onClick={() =>
                      setRecarregando({
                        linkId: link.id,
                        nome: `${reseller.name} · ${link.portfolio.name}`,
                        preco: Number(link.creditPrice),
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResellerFormModal open={criando} onClose={() => setCriando(false)} />
      {recarregando && (
        <RechargeModal
          open
          onClose={() => setRecarregando(null)}
          linkId={recarregando.linkId}
          nome={recarregando.nome}
          precoVigente={recarregando.preco}
        />
      )}
    </div>
  );
}
