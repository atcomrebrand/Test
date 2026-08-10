import { useState } from "react";
import { Plus, Landmark, Pencil, Trash2, ListChecks, TrendingDown, Gauge, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinancingFormModal } from "@/components/FinancingFormModal";
import { PayoffQuoteModal } from "@/components/PayoffQuoteModal";
import { AssetValueModal } from "@/components/AssetValueModal";
import { FinancingInstallmentsModal } from "@/components/FinancingInstallmentsModal";
import { useDeleteFinancing, useFinancings, useFinancingSummary } from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
import { FINANCING_KIND_META } from "@/lib/financingKind";
import { matchAutomakerIcon, matchCarThumbnail } from "@/lib/carIcons";
import { Financing as FinancingType } from "@/types";

export default function Financing() {
  const { data: financings, isLoading } = useFinancings();
  const { data: summary } = useFinancingSummary();
  const deleteFinancing = useDeleteFinancing();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payoffTargetId, setPayoffTargetId] = useState<string | null>(null);
  const [assetValueTargetId, setAssetValueTargetId] = useState<string | null>(null);
  const [installmentsTargetId, setInstallmentsTargetId] = useState<string | null>(null);

  // Look these up fresh from the query cache each render instead of holding a
  // snapshot, so the installments modal reflects pay/unpay actions live.
  const editing = financings?.find((f) => f.id === editingId) ?? null;
  const payoffTarget = financings?.find((f) => f.id === payoffTargetId) ?? null;
  const assetValueTarget = financings?.find((f) => f.id === assetValueTargetId) ?? null;
  const installmentsTarget = financings?.find((f) => f.id === installmentsTargetId) ?? null;

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }
  function openEdit(f: FinancingType) {
    setEditingId(f.id);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Financiamentos"
        description="Carro, moto, casa — controle as parcelas fixas fora do cartão de crédito."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo financiamento
          </Button>
        }
      />

      {summary && summary.totalActive > 0 && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="text-xs text-muted">Valor dos bens</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.equity.assetsValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Falta quitar</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.equity.debt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Patrimônio nos bens</p>
              <p className={`text-lg font-bold ${summary.equity.equity < 0 ? "text-red-500" : "text-emerald-500"}`}>
                {formatCurrency(summary.equity.equity)}
              </p>
            </div>
            {/* Sem esse aviso o total pareceria completo — um bem sem avaliação some do lado dos
                ativos mas continua com a dívida inteira, deixando o patrimônio pessimista. */}
            {summary.equity.withoutAssetValue > 0 && (
              <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {summary.equity.withoutAssetValue} bem
                {summary.equity.withoutAssetValue > 1 ? "s ainda sem valor informado" : " ainda sem valor informado"} — o
                patrimônio acima está incompleto.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !financings || financings.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title="Nenhum financiamento cadastrado"
          description="Cadastre o financiamento do seu carro, moto ou casa e acompanhe as parcelas fixas junto com o resto das suas finanças."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo financiamento
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {financings.map((f) => {
            const meta = FINANCING_KIND_META[f.kind];
            const automaker = f.kind === "CAR" ? matchAutomakerIcon(f.name) : null;
            const carThumb = f.kind === "CAR" ? matchCarThumbnail(f.name) : null;
            const paidCount = f.installments.filter((i) => i.status === "PAID").length;
            const paidAmount = f.installments
              .filter((i) => i.status === "PAID")
              .reduce((acc, i) => acc + Number(i.paidAmount ?? i.amount), 0);
            const totalAmount = f.installmentsCount * Number(f.installmentAmount);
            const progressPct = Math.min((paidCount / f.installmentsCount) * 100, 100);
            const nextInstallment = f.installments.find((i) => i.status === "PENDING" || i.status === "LATE");
            const lateCount = f.installments.filter((i) => i.status === "LATE").length;

            return (
              <Card key={f.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {automaker ? (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                          <automaker.Icon className="h-5 w-5" style={{ color: automaker.color }} />
                        </span>
                      ) : (
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                        >
                          <meta.icon className="h-5 w-5" />
                        </span>
                      )}
                      <div>
                        <p className="font-semibold">{f.name}</p>
                        <p className="text-xs text-muted">
                          {meta.label}
                          {f.institution ? ` · ${f.institution}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(f)} className="rounded-lg p-2 transition-colors hover:surface-2" title="Editar">
                        <Pencil className="h-4 w-4 text-muted" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir o financiamento "${f.name}"? Todas as parcelas serão removidas.`)) {
                            deleteFinancing.mutate(f.id);
                          }
                        }}
                        className="rounded-lg p-2 transition-colors hover:surface-2"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {carThumb && (
                    <div className="flex items-center gap-3 rounded-2xl surface-2 p-3">
                      <carThumb.Thumbnail className="h-12 w-20 shrink-0 text-[rgb(var(--text))]" />
                      <div>
                        <p className="text-sm font-medium">{carThumb.label}</p>
                        <p className="text-xs text-muted">Veículo financiado</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                      <span>
                        {paidCount}/{f.installmentsCount} parcelas pagas
                      </span>
                      <span>{progressPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full surface-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progressPct}%`, backgroundColor: meta.color }}
                      />
                    </div>
                  </div>

                  {lateCount > 0 && (
                    <p className="text-xs font-medium text-red-500">
                      {lateCount} parcela{lateCount > 1 ? "s" : ""} atrasada{lateCount > 1 ? "s" : ""}
                    </p>
                  )}

                  <button
                    onClick={() => setInstallmentsTargetId(f.id)}
                    className="flex w-full items-center justify-between rounded-xl surface-2 px-3 py-2.5 text-left text-sm transition-colors hover:brightness-95 dark:hover:brightness-110"
                  >
                    <span className="flex items-center gap-2 text-muted">
                      <ListChecks className="h-4 w-4" /> Ver todas as parcelas
                    </span>
                    {nextInstallment ? (
                      <span>
                        Próxima: {formatDate(nextInstallment.dueDate)} · {formatCurrency(nextInstallment.amount)}
                      </span>
                    ) : (
                      <span>Quitado 🎉</span>
                    )}
                  </button>

                  {/* Valor do bem e patrimônio: a quitação sozinha só conta a metade negativa —
                      um carro de R$ 60.000 com R$ 20.000 pra quitar são +R$ 40.000, não −R$ 20.000. */}
                  <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3">
                    <div>
                      <p className="text-xs text-muted">Valor do bem</p>
                      {f.assetValue ? (
                        <p className="font-semibold">
                          {formatCurrency(f.assetValue)}
                          {f.assetValueAt && (
                            <span className="ml-1.5 text-xs font-normal text-muted">em {formatDate(f.assetValueAt)}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">Sem avaliação ainda</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAssetValueTargetId(f.id)}>
                      <Gauge className="h-3.5 w-3.5" /> {f.assetValue ? "Atualizar" : "Informar"}
                    </Button>
                  </div>

                  {f.equity.equity !== null ? (
                    <div
                      className={`rounded-xl p-3 ${
                        f.equity.underwater
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      <p className="text-xs opacity-80">Patrimônio neste bem</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(f.equity.equity)}
                        {f.equity.equityPercent !== null && (
                          <span className="ml-1.5 text-xs font-normal opacity-80">
                            {f.equity.equityPercent.toFixed(1)}% do bem
                          </span>
                        )}
                      </p>
                      {f.equity.underwater && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Você deve mais do que o bem vale hoje.
                        </p>
                      )}
                      {f.equity.debtSource === "REMAINING_INSTALLMENTS" && (
                        <p className="mt-1 text-xs opacity-80">
                          Calculado sobre a soma das parcelas restantes — cotar a quitação à vista dá um número mais
                          justo, sem os juros que ainda não venceram.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-xl surface-2 p-3 text-xs text-muted">
                      Informe o valor do bem pra ver quanto dele já é patrimônio seu.
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3">
                    <div>
                      <p className="text-xs text-muted">Quitação à vista</p>
                      {f.payoffAmount ? (
                        <p className="font-semibold">
                          {formatCurrency(f.payoffAmount)}
                          <span className="ml-1.5 text-xs font-normal text-muted">
                            em {formatDate(f.payoffQuotedAt!)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted">Sem cotação ainda</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPayoffTargetId(f.id)}>
                      <TrendingDown className="h-3.5 w-3.5" /> Atualizar
                    </Button>
                  </div>

                  <p className="text-xs text-muted">
                    Pago até agora: {formatCurrency(paidAmount)} de {formatCurrency(totalAmount)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FinancingFormModal open={formOpen} onClose={() => setFormOpen(false)} financing={editing} />
      <PayoffQuoteModal open={Boolean(payoffTarget)} onClose={() => setPayoffTargetId(null)} financing={payoffTarget} />
      <AssetValueModal
        open={Boolean(assetValueTarget)}
        onClose={() => setAssetValueTargetId(null)}
        financing={assetValueTarget}
      />
      <FinancingInstallmentsModal
        open={Boolean(installmentsTarget)}
        onClose={() => setInstallmentsTargetId(null)}
        financing={installmentsTarget}
      />
    </div>
  );
}
