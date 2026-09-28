import { AlertTriangle, ArrowDownCircle, Coins, Pencil, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvestmentFixedIncome } from "../types";
import { YieldingIndicator } from "./YieldingIndicator";

const INDEXER_LABEL: Record<string, string> = {
  PREFIXADO: "Prefixado",
  POS_FIXADO_CDI: "% CDI",
  IPCA_MAIS: "IPCA+",
  OUTRO: "Outro",
};

/**
 * O card de uma aplicação de renda fixa.
 *
 * Vive aqui, e não dentro da página da Carteira, porque as carteiras separadas (a de um filho, por
 * exemplo) mostram exatamente a mesma coisa. Duas cópias do mesmo card sairiam de sincronia na
 * primeira mudança — e este em particular carrega ressalvas que não podem se perder de um lado
 * (o "Investido" ser o principal e não o aportado, o aviso de CDI estimado).
 */
export function FixedIncomeCard({
  f,
  onRegisterInterest,
  onRedeem,
  onUnredeem,
  onEdit,
  onRemove,
}: {
  f: InvestmentFixedIncome;
  onRegisterInterest: () => void;
  onRedeem: () => void;
  onUnredeem: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const daysToMaturity = Math.ceil((new Date(f.maturityDate).getTime() - Date.now()) / 86400000);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{f.institution}</p>
              {!f.redeemedAt && <YieldingIndicator />}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="accent">{f.type}</Badge>
              <Badge tone="neutral">{INDEXER_LABEL[f.indexer]}</Badge>
              {f.redeemedAt && <Badge tone="success">Resgatado</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
              aria-label="Corrigir aplicação"
              title="Corrigir data, valor ou % do CDI"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onRemove} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500" aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl surface-2 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Investido</p>
            {/* O principal (base de rendimento), que é o que o banco chama de "Valor total
                investido" — conferido contra o extrato num CDB que passou por resgate parcial: o
                banco também mostra a base proporcional, não o dinheiro em regime de caixa. Esse
                último existe em calculation.contributedAmount e responde outra pergunta. */}
            <p className="truncate text-sm font-bold">{formatCurrency(f.principalAmount)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">Bruto</p>
            <p className="truncate text-sm font-bold">{formatCurrency(f.calculation.grossValue)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">Líquido</p>
            <p className="truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(f.calculation.netValue)}</p>
          </div>
        </div>

        <div
          className={`rounded-xl p-3 text-sm font-semibold ${
            f.calculation.netYield >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {/* Contra o principal, igual ao "Rendimento líquido" do extrato. */}
          {f.calculation.netYield >= 0 ? "+" : "-"}
          {formatCurrency(Math.abs(f.calculation.netYield))} ({f.calculation.netProfitabilityPercent.toFixed(2)}%)
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg surface-2 p-2">
            <p className="text-muted">IR ({f.calculation.irRate}%)</p>
            <p className="font-semibold">{formatCurrency(f.calculation.irAmount)}</p>
          </div>
          <div className="rounded-lg surface-2 p-2">
            <p className="text-muted">IOF ({f.calculation.iofRate}%)</p>
            <p className="font-semibold">{formatCurrency(f.calculation.iofAmount)}</p>
          </div>
          <div className="rounded-lg surface-2 p-2">
            <p className="text-muted">Rent. líquida</p>
            <p className="font-semibold">{f.calculation.netProfitabilityPercent.toFixed(2)}%</p>
          </div>
        </div>

        {/* Um CDI estimado erra dezenas de reais numa posição grande. Se o número não veio da série
            oficial do Bacen, quem olha precisa saber antes de comparar com o extrato. */}
        {f.cdiSource && !f.cdiSource.official && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            Valor estimado: não deu pra buscar o CDI diário do Banco Central, então a conta usou a taxa atual projetada pro período todo.
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted">
          <span>Aplicado em {formatDate(f.applicationDate)}</span>
          <span>{f.redeemedAt ? `Resgatado em ${formatDate(f.redeemedAt)}` : daysToMaturity >= 0 ? `Vence em ${daysToMaturity} dias` : "Vencido"}</span>
        </div>

        {!f.redeemedAt && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onRegisterInterest}>
              <Coins className="h-4 w-4" />
              Registrar juros
            </Button>
            <Button variant="outline" size="sm" onClick={onRedeem}>
              <ArrowDownCircle className="h-4 w-4" />
              Resgatar
            </Button>
          </div>
        )}

        {f.redeemedAt && (
          <Button variant="outline" size="sm" onClick={onUnredeem}>
            <Undo2 className="h-4 w-4" />
            Desfazer resgate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
