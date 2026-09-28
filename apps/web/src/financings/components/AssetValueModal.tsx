import { FormEvent, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Minus, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUpdateAssetValue, useFinancingAssetValues, AssetValueComparison } from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
import { Financing, FinancingEquity } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  financing: Financing | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registrar quanto o bem vale hoje (FIPE do carro, avaliação do imóvel) e ver a trajetória.
 *
 * A avaliação nova não substitui a anterior — a tabela muda todo mês, e o que interessa é o
 * caminho: a mesma FIPE de R$ 58.000 significa coisas diferentes se veio de R$ 62.000 ou de
 * R$ 55.000.
 */
export function AssetValueModal({ open, onClose, financing }: Props) {
  const updateAssetValue = useUpdateAssetValue();
  const { data: history, isLoading: historyLoading } = useFinancingAssetValues(open ? (financing?.id ?? null) : null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState("");
  const [comparison, setComparison] = useState<AssetValueComparison | null>(null);
  const [equity, setEquity] = useState<FinancingEquity | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(financing?.assetValue ? String(financing.assetValue) : "");
      setDate(todayISO());
      setSource("");
      setComparison(null);
      setEquity(null);
    }
    // Só reseta ao abrir: `financing` muda de referência a cada refetch em background (o próprio
    // save invalida a query), o que apagaria a comparação recém-calculada antes de ser lida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!financing) return;
    updateAssetValue.mutate(
      {
        id: financing.id,
        assetValue: Number(amount),
        valuedAt: new Date(date + "T12:00:00").toISOString(),
        source: source.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          setComparison(result.comparison);
          setEquity(result.financing.equity);
        },
      },
    );
  }

  const chartData = (history?.valuations ?? []).map((v) => ({
    label: new Date(v.valuedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    valor: v.amount,
    fonte: v.source,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Valor do bem">
      {comparison ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl surface-2 p-4">
            <p className="text-sm text-muted">Nova avaliação registrada</p>
            <p className="text-2xl font-bold">{formatCurrency(Number(amount))}</p>
          </div>

          {comparison.previousAmount !== null && comparison.percentChange !== null && (
            <div
              className={`flex items-center gap-3 rounded-2xl p-4 text-sm ${
                comparison.percentChange > 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : comparison.percentChange < 0
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "surface-2 text-muted"
              }`}
            >
              {comparison.percentChange > 0 ? (
                <TrendingUp className="h-5 w-5 shrink-0" />
              ) : comparison.percentChange < 0 ? (
                <TrendingDown className="h-5 w-5 shrink-0" />
              ) : (
                <Minus className="h-5 w-5 shrink-0" />
              )}
              <span>
                {comparison.percentChange === 0
                  ? "Mesmo valor da avaliação anterior"
                  : `${Math.abs(comparison.percentChange).toFixed(1)}% ${comparison.percentChange > 0 ? "acima" : "abaixo"} da avaliação anterior`}{" "}
                ({formatCurrency(comparison.previousAmount)}).
              </span>
            </div>
          )}

          {equity !== null && equity.equity !== null && (
            <div className="flex items-center gap-3 rounded-2xl bg-sky-500/10 p-4 text-sm text-sky-600 dark:text-sky-400">
              <Wallet className="h-5 w-5 shrink-0" />
              <span>
                Patrimônio neste bem agora: <strong>{formatCurrency(equity.equity!)}</strong> — {formatCurrency(equity.assetValue!)} de
                valor menos {formatCurrency(equity.debt)} pra quitar.
              </span>
            </div>
          )}

          {comparison.trend && comparison.trend.daysTracked > 0 && (
            <p className="text-sm text-muted">
              Desde a primeira avaliação ({formatCurrency(comparison.trend.first.amount)}, há {comparison.trend.daysTracked} dias):{" "}
              {comparison.trend.changeSinceFirst >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(comparison.trend.changeSinceFirst))}
              {comparison.trend.changePercentSinceFirst !== null &&
                ` (${comparison.trend.changePercentSinceFirst.toFixed(1)}%)`}
              .
            </p>
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Quanto o bem vale hoje — tabela FIPE pro veículo, valor de mercado pro imóvel. A diferença entre isso e a
            quitação à vista é o seu patrimônio nele.
          </p>
          <Input
            label="Valor do bem (R$)"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
          <Input label="Data da avaliação" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input
            label="Fonte (opcional)"
            placeholder="Tabela FIPE, avaliação da imobiliária…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateAssetValue.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      )}

      {(historyLoading || chartData.length > 0) && (
        <div className="mt-6 border-t border-[rgb(var(--border))] pt-4">
          <p className="mb-2 text-sm font-medium">Histórico de preço</p>
          {historyLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              {/* Com um ponto só não há trajetória pra desenhar — a lista abaixo já diz tudo. */}
              {chartData.length > 1 && (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
                      axisLine={false}
                      tickLine={false}
                      // Avaliação de bem raramente começa no zero e o movimento que interessa está
                      // no topo da faixa — o eixo segue os dados em vez de ancorar em 0.
                      domain={["auto", "auto"]}
                      // Imóvel passa dos seis dígitos e o rótulo inteiro não cabe — em milhares
                      // ("275 mil") o eixo continua legível sem precisar de uma faixa larga só pra
                      // ele. Com 62px de largura os rótulos vinham cortados pela metade.
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v)
                      }
                      width={88}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Valor"]}
                      labelFormatter={(label, payload) => {
                        const fonte = payload?.[0]?.payload?.fonte;
                        return fonte ? `${label} · ${fonte}` : String(label);
                      }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgb(var(--border))",
                        background: "rgb(var(--surface))",
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#0EA5E9"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#0EA5E9" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              <div className="mt-3 flex max-h-40 flex-col gap-2 overflow-y-auto">
                {[...(history?.valuations ?? [])].reverse().map((v, i) => (
                  <div
                    key={`${v.valuedAt}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-muted">
                      {formatDate(v.valuedAt)}
                      {v.source ? ` · ${v.source}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(v.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
