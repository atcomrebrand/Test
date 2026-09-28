import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: { name: string; color: string; total: number }[];
}

export function AutoRenewChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="w-full max-w-[220px] shrink-0 sm:w-1/2 sm:max-w-none">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} assinatura${value === 1 ? "" : "s"}`, ""]}
              contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full flex-1 space-y-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="font-medium">
              {entry.total} assinatura{entry.total === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
