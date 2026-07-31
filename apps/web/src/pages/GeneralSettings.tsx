import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { DangerConfirmModal } from "@/components/DangerConfirmModal";
import { SecuritySettingsCard } from "@/components/SecuritySettingsCard";
import { AssistantMemoryCard } from "@/components/AssistantMemoryCard";
import { useDeleteAccount } from "@/features/useAccount";
import { useThemeStore } from "@/store/theme";

/** Settings that apply to the whole app — every tool, not just Parcelas — live here, reachable
 *  straight from the Home hub. Anything specific to one tool's own data (currency, alert
 *  thresholds, that tool's own data reset) stays in that tool's own settings page instead. */
export default function GeneralSettings() {
  const { mode, setMode } = useThemeStore();
  const deleteAccount = useDeleteAccount();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function handleDelete(password?: string) {
    deleteAccount.mutate(password ?? "", {
      onSuccess: () => toast.success("Conta excluída. Até mais!"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <Link
        to="/"
        className="mb-6 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
      >
        <ArrowLeft className="h-4 w-4" />
        Início
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações gerais</h1>
        <p className="mt-1 text-sm text-muted">Vale pro app inteiro — Parcelas, Investimentos e Horas.</p>
      </div>

      <div className="space-y-4">
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

        <AssistantMemoryCard />

        <SecuritySettingsCard />

        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-500">Zona de perigo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Excluir minha conta</p>
                <p className="text-xs text-muted">
                  Remove permanentemente sua conta e todos os dados de todas as ferramentas. Não pode ser desfeito.
                </p>
              </div>
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                <UserX className="h-4 w-4" /> Excluir conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
