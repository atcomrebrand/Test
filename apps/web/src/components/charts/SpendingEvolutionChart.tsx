import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, MONTH_SHORT } from "@/lib/format";

interface Props {
  data: { year: number; month: number; total: number }[];
}

export function SpendingEvolutionChart({ data }: Props) {
  const chartData = data.map((d) => ({ label: `${MONTH_SHORT[d.month - 1]}/${String(d.year).slice(2)}`, total: d.total }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6D5BFF" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6D5BFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          width={40}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgb(var(--border))",
            background: "rgb(var(--surface))",
            fontSize: 13,
          }}
        />
        <Area type="monotone" dataKey="total" stroke="#6D5BFF" strokeWidth={2.5} fill="url(#colorTotal)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
