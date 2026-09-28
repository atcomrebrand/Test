import { Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { useCrmComparison, useCrmPortfolioId } from "../api";
import { api } from "@/lib/api";

/**
 * Baixa o CSV respeitando o portfólio selecionado (§56).
 *
 * `responseType: "text"` porque o endpoint devolve CSV cru, não o envelope JSON do resto da API —
 * sem isso o axios tenta parsear e o arquivo chega quebrado.
 */
async function baixarCsv(path: string, nome: string, portfolioId: string | null) {
  const qs = portfolioId ? `?portfolioId=${portfolioId}` : "";
  const csv = await api.get<string>(`${path}${qs}`, { responseType: "text" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const { data: comp, isLoading } = useCrmComparison();
  const portfolioId = useCrmPortfolioId();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Relatórios" description="Comparação entre os serviços e exportação dos dados." />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => baixarCsv("/crm/export/customers", "clientes.csv", portfolioId)}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" /> Exportar clientes
        </Button>
        <Button
          variant="outline"
          onClick={() => baixarCsv("/crm/export/resellers", "revendedores.csv", portfolioId)}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" /> Exportar revendedores
        </Button>
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Comparação dos serviços</h2>
        <p className="mb-3 text-xs text-muted">
          Sempre os dois lado a lado, independente do serviço selecionado no topo — é a tela que existe justamente pra
          comparar.
        </p>

        {isLoading || !comp ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {comp.map((c) => (
              <Card key={c.portfolio.id}>
                <CardContent className="flex flex-col gap-3 py-5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.portfolio.color }} />
                    <h3 className="text-lg font-bold">{c.portfolio.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted">Clientes</p>
                      <p className="text-xl font-bold">{c.customers}</p>
                      <p className="text-[11px] text-muted">{c.activeCustomers} ativos</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Revendedores</p>
                      <p className="text-xl font-bold">{c.resellers}</p>
                      {/* Rotulado: é soma de estimativas, não contagem (§44). */}
                      <p className="text-[11px] text-muted">~{c.estimatedResellerClients} clientes (estim.)</p>
                    </div>
                  </div>

                  <div className="surface-2 flex flex-col gap-2 rounded-xl p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Receita direta</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.revenue.direct)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Receita de revenda</span>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {formatCurrency(c.revenue.reseller)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-2">
                      <span className="text-sm font-semibold">Total do mês</span>
                      <span className="text-lg font-bold">{formatCurrency(c.revenue.total)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted">Churn</p>
                      <p className="text-lg font-bold">{c.churnRate !== null ? `${c.churnRate}%` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Crescimento</p>
                      <p
                        className={`text-lg font-bold ${c.netGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {c.netGrowth >= 0 ? "+" : ""}
                        {c.netGrowth}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
