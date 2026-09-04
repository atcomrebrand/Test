import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeftRight,
  Coins,
  Pencil,
  Percent,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { AssetClass, InvestmentAsset, InvestmentFixedIncome } from "../types";
import { YieldingIndicator } from "./YieldingIndicator";

/**
 * Visão em lista da Carteira — a mesma informação do card, numa linha por ativo.
 *
 * O card mostra tudo de uma vez e é ótimo pra olhar um ativo; a lista existe pra **comparar**, que
 * é outra pergunta: com dez posições, a coluna de lucro alinhada responde "onde estou perdendo" num
 * relance que o card, com cada número numa posição diferente da grade, não responde.
 *
 * Nada é escondido de propósito no desktop: o que sai em tela estreita são as colunas que já estão
 * repetidas no card do ativo (`hidden sm/md/lg`), na mesma escada que a lista de revendedores do
 * CRM usa. Ação nenhuma some — botão que existe numa visão existe na outra.
 */
function Coluna({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-right", className)}>
      <p className="text-[11px] leading-none text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}

export function AssetRow({
  asset,
  assetClass,
  onTransaction,
  onIncome,
  onStaking,
  onToggleFavorite,
  onRemove,
}: {
  asset: InvestmentAsset;
  assetClass: AssetClass;
  onTransaction: () => void;
  onIncome: () => void;
  onStaking: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        {/* Linha inteira no celular: espremido junto com os números e os botões, o ticker colapsava
            pra "V…" e a lista perdia justamente o que ela tem de melhor, que é dar pra bater o
            olho. A partir de `sm` tudo volta pra uma linha só. */}
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <Link
            to={`/investimentos/carteira/${asset.id}`}
            className="flex items-center gap-2 text-sm font-semibold hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <span className="truncate">{asset.ticker}</span>
            {assetClass === "CRYPTO" && asset.staking && <YieldingIndicator />}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {asset.broker && <Badge tone="neutral">{asset.broker}</Badge>}
            {asset.wallet && <Badge tone="neutral">{asset.wallet}</Badge>}
          </div>
        </div>

        <Coluna label="Qtd." className="hidden sm:block">
          {asset.position.quantity}
        </Coluna>
        <Coluna label="Preço médio" className="hidden lg:block">
          {formatCurrency(asset.position.averagePrice)}
        </Coluna>
        <Coluna label="Investido" className="hidden md:block">
          {formatCurrency(asset.position.investedAmount)}
        </Coluna>
        <Coluna label="Valor atual">
          {asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}
        </Coluna>

        {/* Sem cotação não existe lucro — mostrar "R$ 0,00" aqui seria dizer que empatou. */}
        <div className="text-right">
          <p className="text-[11px] leading-none text-muted">Lucro</p>
          {asset.profit === null ? (
            <p className="mt-0.5 text-sm font-semibold text-muted">—</p>
          ) : (
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold",
                asset.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {formatCurrency(asset.profit)}
              {asset.profitPercent !== null && (
                <span className="ml-1 text-[11px] font-medium">({asset.profitPercent.toFixed(2)}%)</span>
              )}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={onTransaction} aria-label="Compra ou venda" title="Compra/Venda">
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onIncome} aria-label="Registrar provento" title="Provento">
            <Coins className="h-4 w-4" />
          </Button>
          {assetClass === "CRYPTO" && (
            <Button variant="outline" size="sm" onClick={onStaking} aria-label="Configurar staking" title="Staking">
              <Percent className="h-4 w-4" />
            </Button>
          )}
          <button
            onClick={onToggleFavorite}
            className={cn(
              "rounded-lg p-1.5 transition-colors hover:bg-amber-500/10",
              asset.favorite ? "text-amber-500" : "text-muted hover:text-amber-500",
            )}
            aria-label={asset.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
          >
            <Star className="h-4 w-4" fill={asset.favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={onRemove}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
            aria-label="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FixedIncomeRow({
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
  const diasParaVencer = Math.ceil((new Date(f.maturityDate).getTime() - Date.now()) / 86400000);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        {/* Mesma quebra do AssetRow: nome da instituição sozinho na primeira linha no celular. */}
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{f.institution}</p>
            {!f.redeemedAt && <YieldingIndicator />}
            {/* Mesmo aviso do card: um CDI estimado erra dezenas de reais numa posição grande, e
                quem compara com o extrato precisa saber antes, não depois. */}
            {f.cdiSource && !f.cdiSource.official && (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Valor estimado" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{f.type}</Badge>
            {f.redeemedAt && <Badge tone="success">Resgatado</Badge>}
          </div>
        </div>

        {/* O principal, que é o que o banco chama de "Valor total investido". */}
        <Coluna label="Investido" className="hidden sm:block">
          {formatCurrency(f.principalAmount)}
        </Coluna>
        <Coluna label="Bruto" className="hidden lg:block">
          {formatCurrency(f.calculation.grossValue)}
        </Coluna>
        <Coluna label="Líquido">{formatCurrency(f.calculation.netValue)}</Coluna>

        <div className="text-right">
          <p className="text-[11px] leading-none text-muted">Rendimento</p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold",
              f.calculation.netYield >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(f.calculation.netYield)}
            <span className="ml-1 text-[11px] font-medium">({f.calculation.netProfitabilityPercent.toFixed(2)}%)</span>
          </p>
        </div>

        <div className="hidden text-right md:block">
          <p className="text-[11px] leading-none text-muted">{f.redeemedAt ? "Resgatado" : "Vencimento"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {f.redeemedAt
              ? formatDate(f.redeemedAt)
              : diasParaVencer >= 0
                ? `${diasParaVencer} dias`
                : "Vencido"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {f.redeemedAt ? (
            <Button variant="outline" size="sm" onClick={onUnredeem} aria-label="Desfazer resgate" title="Desfazer resgate">
              <Undo2 className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onRegisterInterest} aria-label="Registrar juros" title="Registrar juros">
                <Coins className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onRedeem} aria-label="Resgatar" title="Resgatar">
                <ArrowDownCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
            aria-label="Corrigir aplicação"
            title="Corrigir data, valor ou % do CDI"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onRemove}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
            aria-label="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
