import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: { day: number; cumulativePaid: number }[];
}

export function PaymentEvolutionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          width={40}
        />
        <Tooltip
          labelFormatter={(day) => `Dia ${day}`}
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="cumulativePaid" stroke="#10B981" strokeWidth={2.5} fill="url(#colorPaid)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
