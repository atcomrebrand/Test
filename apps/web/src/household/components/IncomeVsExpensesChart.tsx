import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Props {
  income: number;
  expenses: number;
}

export function IncomeVsExpensesChart({ income, expenses }: Props) {
  const data = [
    { label: "Entradas", value: income, fill: "#10B981" },
    { label: "Saídas", value: expenses, fill: "#F59E0B" },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
