import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFinancings } from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
import { AssetAvatar } from "../components/AssetAvatar";
import { Financing, FinancingInstallment } from "@/types";

type Row = FinancingInstallment & { financing: Financing };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Em aberto" },
  { value: "ALL", label: "Todas" },
  { value: "PAID", label: "Pagas" },
  { value: "LATE", label: "Atrasadas" },
];

/**
 * Todas as parcelas de todos os financiamentos numa lista só. O modal por financiamento continua
 * existindo pra quem já está olhando um bem específico; esta tela responde a outra pergunta —
 * "o que vence agora, de qualquer um deles".
 */
export default function Parcelas() {
  const { data: financings, isLoading } = useFinancings();
  const [status, setStatus] = useState("OPEN");
  const [financingId, setFinancingId] = useState("ALL");

  const rows = useMemo<Row[]>(() => {
    const all = (financings ?? []).flatMap((f) => f.installments.map((i) => ({ ...i, financing: f })));
    return all
      .filter((r) => (financingId === "ALL" ? true : r.financing.id === financingId))
      .filter((r) => {
        if (status === "ALL") return true;
        if (status === "OPEN") return r.status === "PENDING" || r.status === "LATE";
        return r.status === status;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [financings, status, financingId]);

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  const financingOptions = [
    { value: "ALL", label: "Todos os financiamentos" },
    ...(financings ?? []).map((f) => ({ value: f.id, label: f.name })),
  ];

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Parcelas" description="Todas as parcelas dos seus financiamentos, na ordem de vencimento." />

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Situação"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40"
        />
        <Select
          label="Financiamento"
          options={financingOptions}
          value={financingId}
          onChange={(e) => setFinancingId(e.target.value)}
          className="w-56"
        />
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">{rows.length} parcela(s)</p>
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nenhuma parcela nesse filtro" description="Ajuste a situação ou o financiamento." />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <AssetAvatar financing={r.financing} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.financing.name}</p>
                  <p className="text-xs text-muted">
                    Parcela {r.number}/{r.financing.installmentsCount}
                  </p>
                </div>
                <div className="text-sm text-muted">{formatDate(r.dueDate)}</div>
                <div className="w-28 text-right font-semibold">{formatCurrency(r.amount)}</div>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
