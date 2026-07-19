import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Select, Input } from "@/components/ui/Input";
import { useSettings, useUpdateSettings } from "@/features/useSettings";
import { useThemeStore } from "@/store/theme";
import { Download } from "lucide-react";
import { getToken } from "@/lib/api";

const ALERT_ITEMS: { key: keyof import("@/types").Settings; label: string; description: string }[] = [
  { key: "alertUpcomingDue", label: "Fatura próxima do vencimento", description: "Avisa quando faltam 3 dias ou menos." },
  { key: "alertLimitWarning", label: "Limite quase no fim", description: "Avisa ao ultrapassar o percentual configurado." },
  { key: "alertLateInstall", label: "Parcelas atrasadas", description: "Avisa quando houver parcelas em atraso." },
  { key: "alertSpendingJump", label: "Aumento de gastos", description: "Avisa quando o próximo mês for bem mais caro." },
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const { mode, setMode } = useThemeStore();

  if (isLoading || !settings) {
    return (
      <div>
        <PageHeader title="Configurações" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? "";

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Configurações" description="Personalize sua experiência." />

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onChange={(v) => setMode(v as any)}
            options={[
              { value: "light", label: "Claro" },
              { value: "dark", label: "Escuro" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferências financeiras</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Select
            label="Moeda"
            options={[{ value: "BRL", label: "Real (R$)" }, { value: "USD", label: "Dólar (US$)" }, { value: "EUR", label: "Euro (€)" }]}
            value={settings.currency}
            onChange={(e) => update.mutate({ currency: e.target.value })}
          />
          <Input
            label="Alerta de limite (%)"
            type="number"
            min={1}
            max={100}
            value={settings.limitWarningPct}
            onChange={(e) => update.mutate({ limitWarningPct: Number(e.target.value) })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas inteligentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALERT_ITEMS.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted">{item.description}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings[item.key])}
                onChange={(e) => update.mutate({ [item.key]: e.target.checked } as any)}
                className="h-5 w-5 shrink-0 rounded accent-accent-500"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportar dados</CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={`${apiUrl}/export/installments.csv`}
            onClick={(e) => {
              e.preventDefault();
              fetch(`${apiUrl}/export/installments.csv`, { headers: { Authorization: `Bearer ${getToken()}` } })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "parcelas.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            className="flex w-fit items-center gap-2 rounded-xl surface-2 px-4 py-2 text-sm font-medium transition-colors hover:brightness-95 dark:hover:brightness-110"
          >
            <Download className="h-4 w-4" /> Exportar parcelas (CSV)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
