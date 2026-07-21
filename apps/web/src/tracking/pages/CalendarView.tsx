import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { useTrackingCalendar } from "../api";
import { formatHMS } from "../lib/sessionTime";
import { TrackingCalendarDay } from "../types";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, isLoading } = useTrackingCalendar(year, month);
  const [selectedDay, setSelectedDay] = useState<TrackingCalendarDay | null>(null);

  const byDate = new Map((data ?? []).map((d) => [d.date, d]));

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  function goPrev() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNext() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calendário</h1>
          <p className="text-sm text-muted">Horas e valor recebido, dia a dia.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="rounded-lg p-2 hover:surface-2" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="w-32 text-center text-sm font-semibold">
            {MONTH_NAMES[month - 1]} {year}
          </p>
          <button onClick={goNext} className="rounded-lg p-2 hover:surface-2" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <Card>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
              {WEEKDAY_LABELS.map((l, i) => (
                <div key={i} className="py-1">
                  {l}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} />;
                const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const entry = byDate.get(dateKey);
                const hasData = !!entry && entry.hours > 0;
                return (
                  <button
                    key={idx}
                    onClick={() => entry && setSelectedDay(entry)}
                    disabled={!hasData}
                    className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-colors ${
                      hasData ? "cursor-pointer bg-violet-500/10 hover:bg-violet-500/20" : "text-muted"
                    }`}
                  >
                    <span className="font-medium">{day}</span>
                    {hasData && <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">{entry!.hours}h</span>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" />}
          title="Nenhuma sessão neste mês"
          description="Registre horas no Modo Foco pra ver seu calendário aqui."
        />
      )}

      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : ""}
      >
        {selectedDay && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total do dia</span>
              <span className="font-semibold">
                {formatHMS(selectedDay.sessions.reduce((s, x) => s + x.netSeconds, 0))} · {formatCurrency(selectedDay.revenue)}
              </span>
            </div>
            {selectedDay.sessions.map((s, i) => (
              <div key={i} className="rounded-xl surface-2 p-3 text-sm">
                <div className="flex justify-between">
                  <p className="font-semibold">
                    {s.jobName} — {s.company}
                  </p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.value)}</p>
                </div>
                <p className="text-xs text-muted">
                  {new Date(s.checkIn).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} —{" "}
                  {s.checkOut ? new Date(s.checkOut).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} · {formatHMS(s.netSeconds)}
                </p>
                {s.notes && <p className="mt-1 text-xs text-muted">{s.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
