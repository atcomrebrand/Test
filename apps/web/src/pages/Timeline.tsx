import { motion } from "framer-motion";
import { History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, STATUS_TONE, STATUS_LABEL } from "@/components/ui/Badge";
import { useTimeline } from "@/features/useCalendarTimeline";
import { formatCurrency, monthLabel } from "@/lib/format";

export default function Timeline() {
  const { data: groups, isLoading } = useTimeline();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Linha do Tempo" description="Acompanhe a jornada das suas compras mês a mês." />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const list = groups ?? [];
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  return (
    <div>
      <PageHeader title="Linha do Tempo" description="Acompanhe a jornada das suas compras mês a mês." />

      {list.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="Nada por aqui ainda" description="Suas compras aparecerão organizadas por mês." />
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-0 left-[7px] top-2 w-px bg-[rgb(var(--border))]" />
          {list.map((group, idx) => {
            const key = `${group.year}-${group.month}`;
            const isCurrent = key === currentKey;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="relative mb-8"
              >
                <div
                  className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 ${isCurrent ? "border-accent-500 bg-accent-500" : "surface border-[rgb(var(--border))]"}`}
                />
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-lg font-bold">{monthLabel(group.month, group.year)}</h3>
                  {isCurrent && <Badge tone="accent">Mês atual</Badge>}
                  <span className="ml-auto text-sm font-semibold text-muted">{formatCurrency(group.total)}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.items.map((item: any) => (
                    <div key={item.installmentId} className="flex items-center gap-3 rounded-xl surface border border-[rgb(var(--border))] px-3 py-2.5 shadow-soft">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.category?.color ?? "#999" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted">{item.card?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                        <p className="text-xs text-muted">{item.isCash ? "À vista" : `${item.number}/${item.installmentsCount}`}</p>
                      </div>
                      <Badge tone={STATUS_TONE[item.status]} className="hidden sm:inline-flex">
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
