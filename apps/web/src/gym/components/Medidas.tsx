import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useDeleteMeasurement, useGymMeasurements, useSaveMeasurement } from "../api";

const CAMPOS: { key: string; label: string }[] = [
  { key: "weightKg", label: "Peso (kg)" },
  { key: "chest", label: "Peito" },
  { key: "waist", label: "Cintura" },
  { key: "abdomen", label: "Abdômen" },
  { key: "hip", label: "Quadril" },
  { key: "armRight", label: "Braço dir." },
  { key: "armLeft", label: "Braço esq." },
  { key: "thighRight", label: "Coxa dir." },
  { key: "thighLeft", label: "Coxa esq." },
  { key: "calfRight", label: "Panturrilha dir." },
  { key: "calfLeft", label: "Panturrilha esq." },
];

/** Medidas corporais (§27). Uma medição por dia — remedir substitui, não duplica o ponto. */
export function Medidas() {
  const { data: medidas, isLoading } = useGymMeasurements();
  const salvar = useSaveMeasurement();
  const excluir = useDeleteMeasurement();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  function submeter() {
    const body: Record<string, unknown> = { date: new Date(`${data}T12:00:00`).toISOString() };
    for (const c of CAMPOS) {
      const bruto = valores[c.key];
      if (bruto) body[c.key] = Number(bruto.replace(",", "."));
    }
    if (customLabel.trim() && customValue) {
      body.custom = { [customLabel.trim()]: Number(customValue.replace(",", ".")) };
    }
    salvar.mutate(body, {
      onSuccess: () => {
        setAberto(false);
        setValores({});
        setCustomLabel("");
        setCustomValue("");
      },
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" />
          Registrar medidas
        </Button>
      </div>

      {(!medidas || medidas.length === 0) && (
        <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] py-10 text-center text-sm text-muted">
          Nenhuma medida ainda. Registre a primeira pra começar a acompanhar a evolução.
        </p>
      )}

      {medidas?.map((m) => (
        <Card key={m.id}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{formatDate(m.date)}</p>
              <button
                onClick={() => excluir.mutate(m.id)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label={`Excluir medição de ${formatDate(m.date)}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {CAMPOS.map((c) => {
                const v = (m as unknown as Record<string, number | null>)[c.key];
                if (v === null || v === undefined) return null;
                return (
                  <span key={c.key} className="text-muted">
                    {c.label.replace(" (kg)", "")} <strong className="text-[rgb(var(--text))]">{v}</strong>
                  </span>
                );
              })}
              {m.custom &&
                Object.entries(m.custom).map(([k, v]) => (
                  <span key={k} className="text-muted">
                    {k} <strong className="text-[rgb(var(--text))]">{v}</strong>
                  </span>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Registrar medidas">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {CAMPOS.map((c) => (
              <label key={c.key} className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valores[c.key] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                  placeholder="—"
                  className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm tabular-nums"
                />
              </label>
            ))}
          </div>

          {/* Medida personalizada (§27): não vira coluna nova no banco — vai pro campo `custom`. */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Medida personalizada (ex.: pescoço)"
              className="rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
            />
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              inputMode="decimal"
              placeholder="cm"
              className="w-24 rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
            />
          </div>

          <Button loading={salvar.isPending} onClick={submeter}>
            Salvar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
