import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, Landmark, TrendingDown, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useFinancings, useFinancingSummary } from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
import { AssetAvatar } from "../components/AssetAvatar";

function Tile({
  label,
  value,
  sublabel,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          <p
            className={`text-xl font-bold ${
              tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-red-500" : ""
            }`}
          >
            {value}
          </p>
          {sublabel && <p className="mt-0.5 text-xs text-muted">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VisaoGeral() {
  const { data: summary, isLoading } = useFinancingSummary();
  const { data: financings } = useFinancings();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!summary || summary.totalActive === 0) {
    return (
      <EmptyState
        icon={<Landmark className="h-6 w-6" />}
        title="Nenhum financiamento ativo"
        description="Cadastre o financiamento do seu carro, moto ou casa pra acompanhar parcelas, valor do bem e quanto dele já é patrimônio seu."
        action={
          <Link to="/financiamentos/bens">
            <Button>Cadastrar financiamento</Button>
          </Link>
        }
      />
    );
  }

  const { equity } = summary;
  const ativos = financings?.filter((f) => f.active) ?? [];
  // Só os que têm patrimônio calculável entram no ranking — sem valor do bem não há o que ordenar.
  const comPatrimonio = ativos.filter((f) => f.equity.equity !== null).sort((a, b) => (b.equity.equity ?? 0) - (a.equity.equity ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Visão Geral" description="Quanto os bens valem, quanto falta pagar e o que sobra de patrimônio." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Valor dos bens" value={formatCurrency(equity.assetsValue)} icon={<Wallet className="h-4 w-4" />} />
        <Tile
          label="Falta quitar"
          value={formatCurrency(equity.debt)}
          sublabel="Pela quitação à vista quando cotada"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <Tile
          label="Patrimônio nos bens"
          value={formatCurrency(equity.equity)}
          tone={equity.equity < 0 ? "negative" : "positive"}
          icon={<Landmark className="h-4 w-4" />}
        />
        <Tile
          label="Comprometido no mês"
          value={formatCurrency(summary.committedThisMonth)}
          sublabel={`${summary.totalActive} financiamento${summary.totalActive > 1 ? "s" : ""} ativo${summary.totalActive > 1 ? "s" : ""}`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      {/* Sem esse aviso o patrimônio acima parece completo: um bem sem avaliação sai do lado dos
          ativos mas continua com a dívida inteira, puxando o número pra baixo sem explicação. */}
      {equity.withoutAssetValue > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {equity.withoutAssetValue} bem{equity.withoutAssetValue > 1 ? "s" : ""} ainda sem valor informado — o patrimônio acima está
              subestimado.
            </span>
            <Link to="/financiamentos/bens" className="ml-auto shrink-0 font-medium text-accent-500 hover:underline">
              Informar
            </Link>
          </CardContent>
        </Card>
      )}

      {summary.nextInstallment && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Próxima parcela</p>
              <p className="font-semibold">{summary.nextInstallment.financingName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">{formatDate(summary.nextInstallment.dueDate)}</p>
              <p className="font-semibold">{formatCurrency(summary.nextInstallment.amount)}</p>
            </div>
            <Link to="/financiamentos/parcelas" className="flex items-center gap-1 text-sm font-medium text-accent-500 hover:underline">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {comPatrimonio.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold">Patrimônio por bem</p>
          <div className="flex flex-col gap-3">
            {comPatrimonio.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <AssetAvatar financing={f} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{f.name}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(f.equity.assetValue ?? 0)} − {formatCurrency(f.equity.debt)} de dívida
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${f.equity.underwater ? "text-red-500" : "text-emerald-500"}`}>
                      {formatCurrency(f.equity.equity ?? 0)}
                    </p>
                    {f.equity.equityPercent !== null && <p className="text-xs text-muted">{f.equity.equityPercent.toFixed(1)}% do bem</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
