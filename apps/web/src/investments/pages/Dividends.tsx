import { useMemo, useState } from "react";
import { CalendarDays, Coins } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { Tabs } from "@/components/ui/Tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { useMarketDividends, usePortfolioDividends } from "../api";
import { DividendCalendarEntry, DividendType } from "../types";

const TYPE_LABEL: Record<DividendType, string> = {
  DIVIDENDO: "Dividendo",
  JCP: "JCP",
  OUTRO: "Provento",
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function DividendRow({ entry, showPosition }: { entry: DividendCalendarEntry; showPosition: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2.5 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{entry.ticker}</span>
          <Badge tone={entry.type === "JCP" ? "accent" : "success"}>{TYPE_LABEL[entry.type]}</Badge>
        </div>
        {entry.name && <p className="text-xs text-muted">{entry.name}</p>}
        {entry.relatedTo && <p className="text-xs text-muted">{entry.relatedTo}</p>}
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatCurrency(entry.rate)} / cota</p>
        <p className="text-xs text-muted">
          {entry.exDate && `Data-com: ${formatDate(entry.exDate, { day: "2-digit", month: "2-digit", year: "numeric" })}`}
          {entry.exDate && entry.paymentDate && " · "}
          {entry.paymentDate && `Pagamento: ${formatDate(entry.paymentDate, { day: "2-digit", month: "2-digit", year: "numeric" })}`}
        </p>
        {showPosition && entry.quantityHeld !== null && entry.estimatedAmount !== null && (
          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {entry.quantityHeld} cotas/ações · estimado {formatCurrency(entry.estimatedAmount)}
          </p>
        )}
      </div>
    </div>
  );
}

function DividendCalendarList({ entries, showPosition }: { entries: DividendCalendarEntry[]; showPosition: boolean }) {
  const groups = new Map<string, DividendCalendarEntry[]>();
  for (const entry of entries) {
    const key = monthKey(entry.paymentDate ?? entry.exDate ?? "0000-00");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(groups.entries()).map(([month, monthEntries]) => (
        <div key={month} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-muted">
            {month === "0000-00" ? "Sem data" : formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </p>
          {monthEntries.map((entry, i) => (
            <DividendRow key={`${entry.ticker}-${entry.paymentDate}-${entry.relatedTo}-${i}`} entry={entry} showPosition={showPosition} />
          ))}
        </div>
      ))}
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dividends() {
  const [tab, setTab] = useState<"market" | "portfolio">("portfolio");
  const { data: marketData, isLoading: marketLoading } = useMarketDividends();
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolioDividends();

  const isLoading = tab === "market" ? marketLoading : portfolioLoading;
  const entries = tab === "market" ? marketData : portfolioData;

  /** Only counts events already paid (or, lacking a payment date, past ex-date) — a future/
   *  scheduled event isn't money "recebido" yet, just declared. */
  const totalReceived = useMemo(() => {
    if (tab !== "portfolio" || !portfolioData) return null;
    const today = todayISO();
    return portfolioData
      .filter((e) => (e.paymentDate ?? e.exDate ?? "9999-99-99") <= today)
      .reduce((sum, e) => sum + (e.estimatedAmount ?? 0), 0);
  }, [tab, portfolioData]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Calendário de proventos</h1>
        <p className="text-sm text-muted">
          Dividendos e JCP já declarados/pagos, por ordem de data. O calendário "Todos os ativos" cobre os principais
          pagadores da bolsa, não a lista completa da B3.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as "market" | "portfolio")}
        options={[
          { value: "portfolio", label: "Minha carteira" },
          { value: "market", label: "Todos os ativos" },
        ]}
      />

      {tab === "portfolio" && !portfolioLoading && totalReceived !== null && (
        <StatTile label="Total recebido (estimado, desde a compra)" value={formatCurrency(totalReceived)} icon={<Coins className="h-4 w-4" />} />
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" />}
          title="Nenhum provento encontrado"
          description={
            tab === "portfolio"
              ? "Cadastre ações ou FIIs na sua carteira e registre compras pra ver o calendário de proventos deles aqui."
              : "Não foi possível carregar o calendário do mercado no momento — tente novamente mais tarde."
          }
        />
      )}

      {!isLoading && entries && entries.length > 0 && <DividendCalendarList entries={entries} showPosition={tab === "portfolio"} />}
    </div>
  );
}
