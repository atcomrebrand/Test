import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import { HistoricalPricePoint } from "../types";

interface Props {
  history: HistoricalPricePoint[];
  positive: boolean;
}

export function AssetPriceChart({ history, positive }: Props) {
  const color = positive ? "#10B981" : "#EF4444";
  const chartData = history.map((p) => ({ label: formatDate(p.date, { day: "2-digit", month: "short" }), close: p.close }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} minTickGap={30} />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v)}
          width={70}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2.5} fill="url(#colorPrice)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
