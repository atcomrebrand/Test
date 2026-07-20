import { useMemo, useState } from "react";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDeleteLaunchIncome, useDeleteLaunchTransaction, useLaunches } from "../api";
import { EditLaunchTransactionModal } from "../components/EditLaunchTransactionModal";
import { EditLaunchIncomeModal } from "../components/EditLaunchIncomeModal";
import { LaunchIncome, LaunchTransaction } from "../types";

const INCOME_TYPE_LABEL: Record<string, string> = { DIVIDENDO: "Dividendo", JCP: "JCP", RENDIMENTO: "Rendimento", STAKING: "Staking", OUTRO: "Outro" };

export default function Lancamentos() {
  const { data, isLoading } = useLaunches();
  const [tab, setTab] = useState<"transactions" | "incomes">("transactions");
  const [query, setQuery] = useState("");
  const [editingTx, setEditingTx] = useState<LaunchTransaction | null>(null);
  const [editingIncome, setEditingIncome] = useState<LaunchIncome | null>(null);
  const deleteTx = useDeleteLaunchTransaction();
  const deleteIncome = useDeleteLaunchIncome();

  const normalizedQuery = query.trim().toUpperCase();

  const transactions = useMemo(() => {
    const filtered = (data?.transactions ?? []).filter((t) => !normalizedQuery || t.asset.ticker.includes(normalizedQuery));
    return [...filtered].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [data, normalizedQuery]);

  const incomes = useMemo(() => {
    const filtered = (data?.incomes ?? []).filter((i) => !normalizedQuery || (i.asset?.ticker ?? "").includes(normalizedQuery));
    return [...filtered].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [data, normalizedQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Lançamentos</h1>
        <p className="text-sm text-muted">
          Todas as negociações e proventos da sua carteira num só lugar — corrija ou apague o que precisar (útil logo
          depois de uma importação em massa).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as "transactions" | "incomes")}
          options={[
            { value: "transactions", label: `Negociações (${transactions.length})` },
            { value: "incomes", label: `Proventos (${incomes.length})` },
          ]}
        />
        <Input placeholder="Filtrar por ativo..." value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-[220px]" />
      </div>

      {tab === "transactions" ? (
        transactions.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhuma negociação encontrada"
            description="Registre uma compra/venda em um ativo ou importe um extrato."
          />
        ) : (
          <Card>
            <CardContent className="-mx-5 -mb-5 max-h-[32rem] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 surface-2 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ativo</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium">Qtd</th>
                    <th className="px-3 py-2 text-right font-medium">Preço</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="w-20 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border))]">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-medium">{t.asset.ticker}</td>
                      <td className="px-3 py-2">
                        <Badge tone={t.type === "BUY" ? "success" : "danger"}>{t.type === "BUY" ? "Compra" : "Venda"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{t.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(t.unitPrice))}</td>
                      <td className="px-3 py-2 text-muted">{formatDate(t.transactionDate)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingTx(t)}
                            className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => confirm(`Apagar esta negociação de ${t.asset.ticker}?`) && deleteTx.mutate(t.id)}
                            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                            aria-label="Apagar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : incomes.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Nenhum provento encontrado"
          description="Registre um provento em um ativo ou importe um extrato."
        />
      ) : (
        <Card>
          <CardContent className="-mx-5 -mb-5 max-h-[32rem] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 surface-2 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Ativo</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="w-20 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {incomes.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 font-medium">{i.asset?.ticker ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone="accent">{INCOME_TYPE_LABEL[i.type] ?? i.type}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(i.amount))}</td>
                    <td className="px-3 py-2 text-muted">{formatDate(i.paymentDate)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingIncome(i)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => confirm(`Apagar este provento de ${i.asset?.ticker ?? ""}?`) && deleteIncome.mutate(i.id)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                          aria-label="Apagar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <EditLaunchTransactionModal transaction={editingTx} onClose={() => setEditingTx(null)} />
      <EditLaunchIncomeModal income={editingIncome} onClose={() => setEditingIncome(null)} />
    </div>
  );
}
