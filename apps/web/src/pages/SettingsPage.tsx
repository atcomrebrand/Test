import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DangerConfirmModal } from "@/components/DangerConfirmModal";
import { useSettings, useUpdateSettings } from "@/features/useSettings";
import { useDeleteAccount, useResetAccountData } from "@/features/useAccount";
import { useThemeStore } from "@/store/theme";
import { Download, RotateCcw, UserX } from "lucide-react";
import { getToken } from "@/lib/api";

const ALERT_ITEMS: { key: keyof import("@/types").Settings; label: string; description: string }[] = [
  { key: "alertLimitWarning", label: "Limite quase no fim", description: "Avisa ao ultrapassar o percentual configurado." },
  { key: "alertSpendingJump", label: "Aumento de gastos", description: "Avisa quando o próximo mês for bem mais caro." },
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const { mode, setMode } = useThemeStore();
  const queryClient = useQueryClient();

  const resetData = useResetAccountData();
  const deleteAccount = useDeleteAccount();
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  if (isLoading || !settings) {
    return (
      <div>
        <PageHeader title="Configurações" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? "";

  function handleReset() {
    resetData.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        toast.success("Sua conta foi zerada. Comece do zero quando quiser!");
        setResetModalOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function handleDelete(password?: string) {
    deleteAccount.mutate(password ?? "", {
      onSuccess: () => toast.success("Conta excluída. Até mais!"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

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
          <label className="col-span-2 flex cursor-pointer items-center justify-between gap-4 rounded-xl surface-2 p-3">
            <div>
              <p className="text-sm font-medium">Incluir financiamentos nos totais gerais</p>
              <p className="text-xs text-muted">
                Soma as parcelas de financiamento (carro, moto, casa) no Dashboard — comprometido do mês, saldo
                restante e evolução de gastos.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.includeFinancingInTotals}
              onChange={(e) => update.mutate({ includeFinancingInTotals: e.target.checked })}
              className="h-5 w-5 shrink-0 rounded accent-accent-500"
            />
          </label>
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

      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-500">Zona de perigo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Zerar todos os dados</p>
              <p className="text-xs text-muted">
                Apaga cartões, compras, parcelas e notificações. Seu login e preferências continuam. Ótimo para
                recomeçar um teste do zero.
              </p>
            </div>
            <Button variant="outline" onClick={() => setResetModalOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Zerar dados
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--border))] pt-4">
            <div>
              <p className="text-sm font-medium">Excluir minha conta</p>
              <p className="text-xs text-muted">Remove permanentemente sua conta e todos os dados. Não pode ser desfeito.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
              <UserX className="h-4 w-4" /> Excluir conta
            </Button>
          </div>
        </CardContent>
      </Card>

      <DangerConfirmModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Zerar todos os dados"
        description="Isso vai apagar permanentemente todos os seus cartões, compras, parcelas e notificações. Seu login, tema e categorias padrão continuam intactos. Essa ação não pode ser desfeita."
        confirmWord="ZERAR"
        confirmLabel="Zerar meus dados"
        loading={resetData.isPending}
        onConfirm={handleReset}
      />

      <DangerConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir minha conta"
        description="Isso vai excluir sua conta e todos os dados permanentemente, sem possibilidade de recuperação. Você será desconectado imediatamente."
        confirmWord="EXCLUIR"
        confirmLabel="Excluir minha conta"
        requirePassword
        loading={deleteAccount.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
