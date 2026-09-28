import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: { month: string; capitalInvestido: number }[];
}

function labelFor(month: string) {
  const [year, m] = month.split("-").map(Number);
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1]}/${String(year).slice(2)}`;
}

export function PatrimonyEvolutionChart({ data }: Props) {
  const chartData = data.map((d) => ({ label: labelFor(d.month), total: d.capitalInvestido }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
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
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} fill="url(#colorInvested)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
