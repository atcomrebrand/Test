import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import { ProductPricePoint } from "../types";

/** Unit price over time — the line answers "estou pagando mais caro que antes?", which the total
 *  spent per purchase can't, since that moves with how much was bought. */
export function PriceHistoryChart({ history }: { history: ProductPricePoint[] }) {
  const data = history.map((point) => ({
    label: new Date(`${point.purchaseDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    preco: point.unitPrice,
    loja: point.storeName,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          // Price series rarely start at zero and the interesting movement is at the top of the
          // range, so the axis follows the data instead of anchoring at 0.
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => formatCurrency(v).replace("R$", "").trim()}
          width={52}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), "Preço"]}
          labelFormatter={(label, payload) => {
            const loja = payload?.[0]?.payload?.loja;
            return loja ? `${label} · ${loja}` : String(label);
          }}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Line type="monotone" dataKey="preco" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 4, fill: "#0EA5E9" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
