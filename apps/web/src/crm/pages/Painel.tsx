import { useState } from "react";
import { AlertTriangle, Battery, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useCreatePanelMovement,
  useCreatePanelRecharge,
  useCrmPanelBalances,
  useCrmPanelOverview,
} from "../api";
import { CrmCurrency } from "../types";

function RechargeModal({
  open,
  onClose,
  portfolioId,
  nome,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  nome: string;
  currency: CrmCurrency;
}) {
  const create = useCreatePanelRecharge();
  const [quantity, setQuantity] = useState("100");
  const [unitPrice, setUnitPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <Modal open={open} onClose={onClose} title="Comprar créditos no painel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            {
              portfolioId,
              quantity: Number(quantity),
              unitPrice: Number(unitPrice),
              date: new Date(date).toISOString(),
            },
            { onSuccess: () => onClose() },
          );
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-muted">{nome}</p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantos créditos"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={`Preço por crédito (${currency})`}
            type="number"
            step="0.0001"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </div>

        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        <div className="surface-2 flex items-center justify-between rounded-xl p-3">
          <span className="text-sm text-muted">Total pago</span>
          <span className="text-xl font-bold">{formatCurrency(total, currency)}</span>
        </div>

        <p className="text-xs text-muted">
          O preço fica gravado nesta compra. É a média ponderada de todas elas que vira o custo de cada renovação.
        </p>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Registrar compra
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Ajuste manual: acertar o saldo com o painel de verdade sem inventar uma compra. */
function AjusteModal({ open, onClose, portfolioId }: { open: boolean; onClose: () => void; portfolioId: string }) {
  const create = useCreatePanelMovement();
  const [kind, setKind] = useState("ADJUSTMENT");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Ajustar saldo">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { portfolioId, kind, quantity: Number(quantity), note: note || undefined },
            { onSuccess: () => onClose() },
          );
        }}
        className="flex flex-col gap-3"
      >
        <Select
          label="Tipo"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: "ADJUSTMENT", label: "Ajuste (aceita positivo e negativo)" },
            { value: "CONSUMPTION", label: "Consumo avulso (sempre sai)" },
            { value: "RECHARGE", label: "Crédito avulso (sempre entra)" },
          ]}
        />
        <Input
          label="Quantidade"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          autoFocus
        />
        <Input label="Motivo" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: acerto com o painel" />

        <p className="text-xs text-muted">
          Nada é apagado do extrato — um erro se corrige com um ajuste contrário, que fica visível no histórico.
        </p>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Lançar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ServicoCard({ portfolioId }: { portfolioId: string }) {
  const { data, isLoading } = useCrmPanelOverview(portfolioId);
  const [comprando, setComprando] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-64" />;

  const moeda = data.currency;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.portfolio.color }} />
        <h2 className="text-lg font-bold">{data.portfolio.name}</h2>
        <span className="surface-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium">{moeda}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAjustando(true)}>
            Ajustar
          </Button>
          <Button size="sm" onClick={() => setComprando(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Comprar créditos
          </Button>
        </div>
      </div>

      {/* Saldo em destaque: é o número que decide se dá pra renovar hoje. */}
      <Card className={cn(data.lowCredit && "border-l-4 border-l-amber-500")}>
        <CardContent className="flex flex-wrap items-center gap-6 py-5">
          <div>
            <p className="text-xs text-muted">Créditos disponíveis</p>
            <p className={cn("text-4xl font-bold tracking-tight", data.balance <= 0 && "text-red-500")}>
              {data.balance}
            </p>
            {data.lowCredit && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {data.balance <= 0 ? "renovações bloqueadas" : `abaixo do limite (${data.threshold})`}
              </p>
            )}
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Comprados</p>
              <p className="text-lg font-semibold">{data.purchased}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Consumidos</p>
              <p className="text-lg font-semibold">{data.used}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Preço médio</p>
              <p className="text-lg font-semibold">
                {data.averagePrice !== null ? formatCurrency(data.averagePrice, moeda) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Estoque vale</p>
              <p className="text-lg font-semibold">
                {data.stockValue !== null ? formatCurrency(data.stockValue, moeda) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.movements.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-2 text-sm font-semibold">Extrato do painel</p>
            <div className="flex flex-col divide-y divide-[rgb(var(--border))]">
              {data.movements.slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-24 shrink-0 text-xs text-muted">{formatDate(m.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.note ??
                      (m.kind === "CONSUMPTION" ? "Consumo" : m.kind === "RECHARGE" ? "Compra" : "Ajuste")}
                  </span>
                  <span className={cn("font-semibold", m.quantity > 0 ? "text-emerald-500" : "text-red-500")}>
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 border-t border-[rgb(var(--border))] pt-2 text-right text-sm">
              Saldo: <strong>{data.balance} créditos</strong> · investido {formatCurrency(data.totalSpent, moeda)}
            </p>
          </CardContent>
        </Card>
      )}

      <RechargeModal
        open={comprando}
        onClose={() => setComprando(false)}
        portfolioId={portfolioId}
        nome={data.portfolio.name}
        currency={moeda}
      />
      <AjusteModal open={ajustando} onClose={() => setAjustando(false)} portfolioId={portfolioId} />
    </section>
  );
}

/**
 * Estoque próprio de créditos — o que você compra do painel de cima e gasta renovando cliente.
 *
 * Mostra os dois serviços juntos, independente do seletor do topo: o saldo é o recurso que limita a
 * operação inteira, e esconder metade dele atrás de um filtro é o jeito mais rápido de descobrir que
 * acabou só na hora de renovar.
 */
export default function Painel() {
  const { data: saldos, isLoading } = useCrmPanelBalances();

  if (isLoading || !saldos) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel de créditos"
        description="Quantos créditos você tem, quanto pagou por eles e para onde foram."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {saldos.map((s) => (
          <Card key={s.portfolio.id} className={cn(s.lowCredit && "border-l-4 border-l-amber-500")}>
            <CardContent className="flex items-center gap-3 py-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${s.portfolio.color}1a`, color: s.portfolio.color }}
              >
                <Battery className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.portfolio.name}</p>
                <p className="text-xs text-muted">
                  {s.currency}
                  {s.averagePrice !== null && ` · ${formatCurrency(s.averagePrice, s.currency)}/crédito`}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-2xl font-bold", s.balance <= 0 && "text-red-500")}>{s.balance}</p>
                {s.stockValue !== null && (
                  <p className="text-[11px] text-muted">{formatCurrency(s.stockValue, s.currency)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-start gap-2 py-3 text-sm text-muted">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <span>
            Cada renovação desconta os créditos do pacote do cliente. Quando o saldo não cobre, a renovação é
            bloqueada — registre a compra do painel primeiro.
          </span>
        </CardContent>
      </Card>

      {saldos.map((s) => (
        <ServicoCard key={s.portfolio.id} portfolioId={s.portfolio.id} />
      ))}
    </div>
  );
}
