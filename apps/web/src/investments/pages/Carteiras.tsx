import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  useCreateInvestmentPortfolio,
  useDeleteFixedIncome,
  useDeleteInvestmentPortfolio,
  useInvestmentPortfolio,
  useInvestmentPortfolios,
  usePortfolioFixedIncomes,
  useRedeemFixedIncome,
  useUnredeemFixedIncome,
} from "../api";
import { InvestmentFixedIncome } from "../types";
import { FixedIncomeCard } from "../components/FixedIncomeCard";
import { FixedIncomeFormModal } from "../components/FixedIncomeFormModal";
import { AddInterestModal } from "../components/AddInterestModal";
import { RedeemFixedIncomeModal } from "../components/RedeemFixedIncomeModal";

const CORES = ["#EC4899", "#0072B2", "#009E73", "#E69F00", "#CC79A7", "#6E6E7A"];

function NovaCarteiraModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const criar = useCreateInvestmentPortfolio();
  const [name, setName] = useState("");
  const [color, setColor] = useState(CORES[0]);

  return (
    <Modal open={open} onClose={onClose} title="Nova carteira">
      <div className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Carteira da Sofia"
          autoFocus
        />

        <div>
          <p className="mb-1.5 text-sm font-medium">Cor</p>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-[rgb(var(--text))]" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <p className="surface-2 rounded-xl p-3 text-xs text-muted">
          O dinheiro desta carteira fica só aqui: não entra no seu patrimônio, nem no dashboard, nem no gráfico de
          evolução da sua carteira. Por enquanto ela guarda só renda fixa.
        </p>

        <Button
          loading={criar.isPending}
          disabled={name.trim().length === 0}
          onClick={() => criar.mutate({ name: name.trim(), color }, { onSuccess: () => { setName(""); onClose(); } })}
        >
          Criar carteira
        </Button>
      </div>
    </Modal>
  );
}

/** A lista de carteiras separadas. A principal não aparece aqui de propósito — ela é a Carteira do
 *  menu, e repetir ela nesta lista faria parecer que existe uma terceira. */
export function Carteiras() {
  const { data: carteiras, isLoading } = useInvestmentPortfolios();
  const [criando, setCriando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-5 w-5 text-muted" />
            Outras carteiras
          </h1>
          <p className="text-sm text-muted">
            Pra cuidar do investimento de outra pessoa sem misturar com o seu dinheiro.
          </p>
        </div>
        <Button onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" />
          Nova carteira
        </Button>
      </div>

      {isLoading && <Skeleton className="h-28" />}

      {!isLoading && (carteiras ?? []).length === 0 && (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhuma carteira separada"
          description="Crie uma pra acompanhar o investimento de um filho, por exemplo. O dinheiro dela não entra no seu patrimônio."
          action={<Button onClick={() => setCriando(true)}>Criar carteira</Button>}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(carteiras ?? []).map((c) => (
          <Card key={c.id}>
            <Link to={`/investimentos/carteiras/${c.id}`}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#6E6E7A" }} />
                  <p className="truncate font-semibold">{c.name}</p>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <div>
                    <p className="text-[11px] leading-none text-muted">Valor hoje</p>
                    <p className="text-xl font-bold">{formatCurrency(c.summary.netValue)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] leading-none text-muted">Investido</p>
                    <p className="font-semibold">{formatCurrency(c.summary.invested)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] leading-none text-muted">Rendimento</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(c.summary.netYield)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted">
                  {c.summary.count} aplicação(ões) ativa(s)
                  {c.summary.redeemedCount > 0 && ` · ${c.summary.redeemedCount} resgatada(s)`}
                </p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <NovaCarteiraModal open={criando} onClose={() => setCriando(false)} />
    </div>
  );
}

/** Uma carteira separada por dentro: as mesmas aplicações, os mesmos cards e as mesmas ações da
 *  Renda Fixa principal — o card vem literalmente do mesmo componente. */
export function CarteiraDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: carteira, isLoading } = useInvestmentPortfolio(id);
  const { data: aplicacoes } = usePortfolioFixedIncomes(id);
  const excluirCarteira = useDeleteInvestmentPortfolio();
  const removerAplicacao = useDeleteFixedIncome();
  const desfazerResgate = useUnredeemFixedIncome();

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<InvestmentFixedIncome | null>(null);
  const [jurosDe, setJurosDe] = useState<string | null>(null);
  const [resgatando, setResgatando] = useState<InvestmentFixedIncome | null>(null);
  const [desfazendo, setDesfazendo] = useState<InvestmentFixedIncome | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  if (isLoading || !carteira) return <Skeleton className="h-96" />;

  const ativas = (aplicacoes ?? []).filter((f) => !f.redeemedAt);
  const resgatadas = (aplicacoes ?? []).filter((f) => f.redeemedAt);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/investimentos/carteiras" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Outras carteiras
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: carteira.color ?? "#6E6E7A" }} />
          <h1 className="text-xl font-bold">{carteira.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Nova aplicação
          </Button>
          <Button variant="ghost" onClick={() => setExcluindo(true)} aria-label="Excluir carteira">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-8 gap-y-3 py-4">
          <div>
            <p className="text-[11px] leading-none text-muted">Valor hoje</p>
            <p className="text-2xl font-bold">{formatCurrency(carteira.summary.netValue)}</p>
          </div>
          <div>
            <p className="text-[11px] leading-none text-muted">Investido</p>
            <p className="font-semibold">{formatCurrency(carteira.summary.invested)}</p>
          </div>
          <div>
            <p className="text-[11px] leading-none text-muted">Rendimento líquido</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(carteira.summary.netYield)}{" "}
              <span className="text-xs">({carteira.summary.netYieldPercent.toFixed(2)}%)</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {ativas.length === 0 && resgatadas.length === 0 && (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhuma aplicação ainda"
          description="Cadastre a primeira aplicação desta carteira. As contas são as mesmas da sua renda fixa: CDI real, IR e IOF."
          action={<Button onClick={() => setCriando(true)}>Cadastrar aplicação</Button>}
        />
      )}

      {ativas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ativas.map((f) => (
            <FixedIncomeCard
              key={f.id}
              f={f}
              onRegisterInterest={() => setJurosDe(f.id)}
              onRedeem={() => setResgatando(f)}
              onUnredeem={() => setDesfazendo(f)}
              onEdit={() => setEditando(f)}
              onRemove={() => removerAplicacao.mutate(f.id)}
            />
          ))}
        </div>
      )}

      {resgatadas.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted">Resgatadas</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {resgatadas.map((f) => (
              <FixedIncomeCard
                key={f.id}
                f={f}
                onRegisterInterest={() => setJurosDe(f.id)}
                onRedeem={() => setResgatando(f)}
                onUnredeem={() => setDesfazendo(f)}
                onEdit={() => setEditando(f)}
                onRemove={() => removerAplicacao.mutate(f.id)}
              />
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-muted">
        Este dinheiro não entra no seu patrimônio, no dashboard nem no gráfico de evolução da sua carteira.
      </p>

      {/* `portfolioId` é o que faz a aplicação nascer aqui em vez de na sua carteira. */}
      <FixedIncomeFormModal open={criando} onClose={() => setCriando(false)} portfolioId={id} />
      <FixedIncomeFormModal open={!!editando} onClose={() => setEditando(null)} fixedIncome={editando} />
      <AddInterestModal fixedIncomeId={jurosDe} onClose={() => setJurosDe(null)} />
      <RedeemFixedIncomeModal fixedIncome={resgatando} onClose={() => setResgatando(null)} />

      <ConfirmModal
        open={!!desfazendo}
        onClose={() => setDesfazendo(null)}
        title="Desfazer resgate"
        confirmLabel="Desfazer resgate"
        onConfirm={() => {
          if (!desfazendo) return;
          desfazerResgate.mutate(desfazendo.id, { onSuccess: () => setDesfazendo(null) });
        }}
        description="Isso volta a aplicação pro estado ativo."
      />

      <ConfirmModal
        open={excluindo}
        onClose={() => setExcluindo(false)}
        title="Excluir carteira"
        confirmLabel="Excluir"
        loading={excluirCarteira.isPending}
        onConfirm={() => id && excluirCarteira.mutate(id, { onSuccess: () => setExcluindo(false) })}
        description={
          <p>
            Só dá pra excluir uma carteira vazia. Se ainda houver aplicação aqui, remova ou resgate antes — mover o
            dinheiro pra sua carteira automaticamente seria o oposto do que esta separação existe pra fazer.
          </p>
        }
      />
    </div>
  );
}
