import { useEffect, useState } from "react";
import { CloudOff, Save } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/auth";
import { useGymProfile, useUpdateGymProfile } from "../api";
import { REST_PRESETS } from "../domain/rest-timer";
import { useGymSync } from "../useGymSync";
import { GYM, LEVEL_LABEL, OBJECTIVE_LABEL } from "../theme";
import { GymLevel, GymObjective, GymOneRmFormula, GymWeightUnit } from "../types";

export default function Perfil() {
  const user = useAuthStore((s) => s.user);
  const { data: perfil, isLoading } = useGymProfile();
  const salvar = useUpdateGymProfile();
  const { pendingCount, syncing } = useGymSync();
  const [form, setForm] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (perfil && !form) {
      setForm({
        objective: perfil.objective,
        level: perfil.level,
        heightCm: perfil.heightCm ?? "",
        weeklyTarget: perfil.weeklyTarget,
        sessionMinutes: perfil.sessionMinutes,
        defaultRestSeconds: perfil.defaultRestSeconds,
        weightUnit: perfil.weightUnit,
        oneRmFormula: perfil.oneRmFormula,
        soundEnabled: perfil.soundEnabled,
        vibrationEnabled: perfil.vibrationEnabled,
      });
    }
  }, [perfil, form]);

  if (isLoading || !perfil || !form) return <Skeleton className="h-96 rounded-3xl" />;

  const set = (patch: Record<string, unknown>) => setForm((f) => ({ ...f!, ...patch }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-neutral-900", GYM.solid)}>
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight">{user?.name}</h1>
          <p className="text-sm text-muted">
            {OBJECTIVE_LABEL[perfil.objective]} · {LEVEL_LABEL[perfil.level]}
          </p>
        </div>
      </div>

      {pendingCount > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <CloudOff className="h-4 w-4" />
          {syncing
            ? `Enviando ${pendingCount} treino(s) guardado(s) no aparelho...`
            : `${pendingCount} treino(s) guardado(s) no aparelho, aguardando conexão.`}
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 py-4">
          <Grupo label="Objetivo">
            {(Object.keys(OBJECTIVE_LABEL) as GymObjective[]).map((o) => (
              <Opcao key={o} ativo={form.objective === o} onClick={() => set({ objective: o })}>
                {OBJECTIVE_LABEL[o]}
              </Opcao>
            ))}
          </Grupo>

          <Grupo label="Nível">
            {(Object.keys(LEVEL_LABEL) as GymLevel[]).map((n) => (
              <Opcao key={n} ativo={form.level === n} onClick={() => set({ level: n })}>
                {LEVEL_LABEL[n]}
              </Opcao>
            ))}
          </Grupo>

          <Grupo label="Treinos por semana">
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <Opcao key={n} ativo={form.weeklyTarget === n} onClick={() => set({ weeklyTarget: n })}>
                {n}x
              </Opcao>
            ))}
          </Grupo>

          <Grupo label="Tempo por treino">
            {[30, 45, 60, 75, 90, 120].map((n) => (
              <Opcao key={n} ativo={form.sessionMinutes === n} onClick={() => set({ sessionMinutes: n })}>
                {n} min
              </Opcao>
            ))}
          </Grupo>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Altura (cm)</span>
            <input
              value={String(form.heightCm ?? "")}
              onChange={(e) => set({ heightCm: e.target.value })}
              inputMode="numeric"
              placeholder="—"
              className="w-32 rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm tabular-nums"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-4">
          <p className="text-sm font-bold">Treino</p>

          {/* §33: vira o padrão de todo exercício NOVO. Não reescreve o que já foi configurado. */}
          <Grupo label="Descanso padrão">
            {REST_PRESETS.map((s) => (
              <Opcao key={s} ativo={form.defaultRestSeconds === s} onClick={() => set({ defaultRestSeconds: s })}>
                {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`}
              </Opcao>
            ))}
          </Grupo>
          <p className="-mt-2 text-[11px] text-muted">
            Usado quando você adiciona um exercício novo num treino. Os que já existem mantêm o descanso deles.
          </p>

          <Grupo label="Unidade">
            {(["KG", "LB"] as GymWeightUnit[]).map((u) => (
              <Opcao key={u} ativo={form.weightUnit === u} onClick={() => set({ weightUnit: u })}>
                {u === "KG" ? "Quilos" : "Libras"}
              </Opcao>
            ))}
          </Grupo>

          <Grupo label="Fórmula de 1RM">
            {(["EPLEY", "BRZYCKI", "LOMBARDI"] as GymOneRmFormula[]).map((f) => (
              <Opcao key={f} ativo={form.oneRmFormula === f} onClick={() => set({ oneRmFormula: f })}>
                {f[0] + f.slice(1).toLowerCase()}
              </Opcao>
            ))}
          </Grupo>
          <p className="-mt-2 text-[11px] text-muted">
            As três divergem conforme a faixa de repetições. Recordes já conquistados guardam o valor de quando
            aconteceram — trocar aqui não reescreve o passado.
          </p>

          <div className="space-y-2">
            <Switch label="Som ao terminar o descanso" value={!!form.soundEnabled} onChange={(v) => set({ soundEnabled: v })} />
            <Switch label="Vibração ao terminar o descanso" value={!!form.vibrationEnabled} onChange={(v) => set({ vibrationEnabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        loading={salvar.isPending}
        onClick={() =>
          salvar.mutate({
            ...form,
            heightCm: form.heightCm ? Number(form.heightCm) : undefined,
          } as never)
        }
      >
        <Save className="h-4 w-4" />
        Salvar
      </Button>
    </div>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Opcao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
        ativo ? cn("text-neutral-900", GYM.solid) : "surface-2 text-muted hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}

function Switch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="flex w-full items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2.5 text-left text-sm font-medium"
    >
      {label}
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-lime-500" : "bg-neutral-400/40")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", value ? "left-[1.375rem]" : "left-0.5")} />
      </span>
    </button>
  );
}
