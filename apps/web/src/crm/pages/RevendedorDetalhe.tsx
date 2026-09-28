import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCreateMovement, useCrmReseller, useUpdateApproxClients } from "../api";
import { RechargeModal } from "../components/RechargeModal";
import { ResellerFormModal } from "../components/ResellerFormModal";
import { ActivityDot, ResellerStatusBadge } from "../components/StatusBadge";
import { RechargeButton, WhatsappButton } from "../components/QuickActions";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="surface-2 rounded-xl p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** Edição inline da estimativa, com o histórico logo abaixo (§37). */
function ApproxEditor({ linkId, value, updatedAt }: { linkId: string; value: number; updatedAt: string | null }) {
  const update = useUpdateApproxClients();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="surface-2 flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:brightness-95"
      >
        <Users className="h-4 w-4 shrink-0 text-violet-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Clientes ativos aproximados</p>
          <p className="text-lg font-bold">~{value}</p>
          <p className="text-[11px] text-muted">
            Estimativa informada — não é contagem do CRM
            {updatedAt && ` · atualizada em ${formatDate(updatedAt)}`}
          </p>
        </div>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <div className="surface-2 flex items-end gap-2 rounded-xl p-3">
      <Input
        label="Clientes aproximados"
        type="number"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        className="flex-1"
      />
      <Button
        size="sm"
        loading={update.isPending}
        onClick={() =>
          update.mutate({ linkId, value: Number(draft) }, { onSuccess: () => setEditing(false) })
        }
      >
        Salvar
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}

export default function RevendedorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: r, isLoading } = useCrmReseller(id);
  const movement = useCreateMovement();
  const [editando, setEditando] = useState(false);
  const [recarregando, setRecarregando] = useState<{ linkId: string; nome: string; preco: number } | null>(null);
  const [usando, setUsando] = useState<Record<string, string>>({});

  if (isLoading || !r) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/crm/revendedores" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" /> Revendedores
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 py-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{r.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {r.companyName && `${r.companyName} · `}
              {r.phone}
              {r.email && ` · ${r.email}`}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setEditando(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </CardContent>
      </Card>

      {/* Um bloco por serviço: saldo, extrato e estimativa não se somam entre portfólios (§45). */}
      {r.portfolios.map((link) => {
        const det = r.details.find((d) => d.linkId === link.id);
        return (
          <section key={link.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: link.portfolio.color }} />
              <h2 className="text-lg font-bold">{link.portfolio.name}</h2>
              <ResellerStatusBadge status={link.status} />
              <ActivityDot activity={link.activity} days={link.daysSinceLastRecharge} />
              <div className="ml-auto flex items-center gap-1.5">
                <WhatsappButton linkId={link.id} />
                <RechargeButton
                  onClick={() =>
                    setRecarregando({
                      linkId: link.id,
                      nome: `${r.name} · ${link.portfolio.name}`,
                      preco: Number(link.creditPrice),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Saldo de créditos"
                value={link.credits.balance}
                sub={link.lowCredit ? `abaixo do limite (${link.lowCreditThreshold})` : "disponível"}
              />
              <Stat label="Comprados" value={link.credits.purchased} />
              <Stat label="Utilizados" value={link.credits.used} />
              <Stat label="Total gasto" value={formatCurrency(link.credits.totalSpent)} />
              <Stat label="Recargas" value={det?.stats.totalRecharges ?? 0} />
              <Stat
                label="Preço médio"
                value={det?.stats.averageCreditPrice !== null && det ? formatCurrency(det.stats.averageCreditPrice!) : "—"}
                sub={`vigente ${formatCurrency(link.creditPrice)}`}
              />
              <Stat
                label="Recargas/mês"
                value={det?.stats.rechargesPerMonth !== null && det ? det.stats.rechargesPerMonth!.toFixed(1) : "—"}
              />
              <Stat label="Revendedor há" value={link.tenure?.label ?? "—"} />
            </div>

            <ApproxEditor linkId={link.id} value={link.approxActiveClients} updatedAt={link.approxUpdatedAt} />

            {/* Baixa de créditos: o caso de uso é "usei N pro cliente tal", e por isso é um campo
                de número solto em vez de um formulário. */}
            <div className="surface-2 flex flex-wrap items-end gap-2 rounded-xl p-3">
              <Input
                label="Dar baixa em créditos"
                type="number"
                min="1"
                placeholder="Quantos foram usados"
                value={usando[link.id] ?? ""}
                onChange={(e) => setUsando({ ...usando, [link.id]: e.target.value })}
                className="w-48"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={movement.isPending}
                disabled={!usando[link.id]}
                onClick={() =>
                  movement.mutate(
                    { linkId: link.id, data: { kind: "USAGE", quantity: Number(usando[link.id]) } },
                    { onSuccess: () => setUsando({ ...usando, [link.id]: "" }) },
                  )
                }
                className="gap-1.5"
              >
                <Minus className="h-3.5 w-3.5" /> Dar baixa
              </Button>
            </div>

            {det && det.movements.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="mb-2 text-sm font-semibold">Extrato de créditos</p>
                  <div className="flex flex-col divide-y divide-[rgb(var(--border))]">
                    {det.movements.slice(0, 20).map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-2">
                        <span className="text-xs text-muted">{formatDate(m.createdAt)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {m.note ?? (m.kind === "USAGE" ? "Utilização" : m.kind === "RECHARGE" ? "Recarga" : "Ajuste")}
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            m.quantity > 0 ? "text-emerald-500" : "text-red-500",
                          )}
                        >
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 border-t border-[rgb(var(--border))] pt-2 text-right text-sm">
                    Saldo atual: <strong>{link.credits.balance} créditos</strong>
                  </p>
                </CardContent>
              </Card>
            )}

            {det && det.priceChanges.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="mb-2 text-sm font-semibold">Histórico de preço do crédito</p>
                  {det.priceChanges.map((p) => (
                    <p key={p.id} className="text-xs text-muted">
                      {formatDate(p.changedAt)}: {formatCurrency(p.previousPrice)} → {formatCurrency(p.newPrice)}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {det && det.approxChanges.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="mb-2 text-sm font-semibold">Histórico da estimativa de clientes</p>
                  {det.approxChanges.map((a) => (
                    <p key={a.id} className="text-xs text-muted">
                      {formatDate(a.changedAt)}: {a.previousValue} → {a.newValue}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        );
      })}

      <ResellerFormModal open={editando} onClose={() => setEditando(false)} reseller={r} />
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
