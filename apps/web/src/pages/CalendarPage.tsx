import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCalendarMonth, useCalendarYear } from "@/features/useCalendarTimeline";
import { formatCurrency, formatDate, MONTH_NAMES } from "@/lib/format";
import { cn } from "@/lib/cn";

const WEIGHT_STYLES: Record<string, string> = {
  none: "surface-2 text-muted",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  high: "bg-red-500/20 text-red-700 dark:text-red-300",
};

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const { data: months, isLoading } = useCalendarYear(year);
  const { data: monthInstallments, isLoading: monthLoading } = useCalendarMonth(year, selectedMonth);

  return (
    <div>
      <PageHeader
        title="Calendário Financeiro"
        description="Visualize o peso financeiro de cada mês."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(year - 1)} className="rounded-lg p-2 hover:surface-2">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-14 text-center font-semibold">{year}</span>
            <button onClick={() => setYear(year + 1)} className="rounded-lg p-2 hover:surface-2">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {months?.map((m, idx) => (
            <motion.button
              key={m.month}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => setSelectedMonth(m.month)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border border-[rgb(var(--border))] p-4 text-left shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-elevated",
                WEIGHT_STYLES[m.weight],
              )}
            >
              <p className="text-sm font-semibold">{MONTH_NAMES[m.month - 1]}</p>
              <p className="text-lg font-bold">{formatCurrency(m.total)}</p>
              <p className="text-xs opacity-80">
                {m.purchasesCount} compra(s) · {m.installmentsCount} parcela(s)
              </p>
            </motion.button>
          ))}
        </div>
      )}

      <Modal
        open={selectedMonth !== null}
        onClose={() => setSelectedMonth(null)}
        title={selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} de ${year}` : ""}
        size="lg"
      >
        {monthLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !monthInstallments || monthInstallments.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhuma parcela neste mês" />
        ) : (
          <div className="space-y-2">
            {monthInstallments.map((inst) => (
              <div key={inst.id} className="flex items-center gap-3 rounded-xl surface-2 px-3 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: inst.purchase?.category?.color ?? "#999" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inst.purchase?.name}</p>
                  <p className="text-xs text-muted">
                    {inst.card?.name} · Parcela {inst.number}/{inst.purchase?.installmentsCount} · vence {formatDate(inst.dueDate)}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(inst.amount)}</p>
                <Badge tone={STATUS_TONE[inst.status]}>{STATUS_LABEL[inst.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
