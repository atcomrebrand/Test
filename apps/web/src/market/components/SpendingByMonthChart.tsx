import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, MONTH_SHORT } from "@/lib/format";
import { MonthlySpending } from "../types";

/** "2026-08" → "Ago/26". */
function monthTick(month: string): string {
  const [year, mes] = month.split("-");
  return `${MONTH_SHORT[Number(mes) - 1]}/${year.slice(2)}`;
}

/** Spend and tax side by side rather than stacked: the tax is already *inside* the spend, so
 *  stacking them would draw a bar taller than what was actually paid. */
export function SpendingByMonthChart({ months }: { months: MonthlySpending[] }) {
  const data = months.map((m) => ({ label: monthTick(m.month), Gasto: m.totalSpent, Tributos: m.totalTax }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          // One decimal on the k, because rounding to whole thousands labels 1200 as "1k" and 1600
          // as "2k" — two ticks reading the same, and neither being the value it sits at.
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v))}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Gasto" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
        <Bar dataKey="Tributos" fill="#F59E0B" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
