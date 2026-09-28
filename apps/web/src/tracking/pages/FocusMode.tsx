import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Square, Check, Timer, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import {
  useActiveSession,
  useTrackingJobs,
  useTrackingSessions,
  useStartSession,
  usePauseSession,
  useResumeSession,
  useFinishSession,
  useUpdateSessionManual,
} from "../api";
import { usePlacementPrompt } from "../hooks/usePlacementPrompt";
import { useLiveElapsed } from "../hooks/useLiveElapsed";
import { formatHMS, isSameLocalDay, isSameLocalMonth } from "../lib/sessionTime";
import { TrackingSession } from "../types";
import { PendingPaymentBanner } from "../components/PendingPaymentBanner";
import { AddPastSessionModal } from "../components/AddPastSessionModal";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function FocusMode() {
  const { data: activeSession, isLoading: activeLoading } = useActiveSession();
  const { data: jobs, isLoading: jobsLoading } = useTrackingJobs();
  const { data: sessions } = useTrackingSessions();

  const [selectedJobId, setSelectedJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [summarySession, setSummarySession] = useState<TrackingSession | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const { askIfNeeded, placementModal } = usePlacementPrompt();
  const [editingCheckIn, setEditingCheckIn] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState("");
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [addPastOpen, setAddPastOpen] = useState(false);
  const [showRetroStart, setShowRetroStart] = useState(false);
  const [retroStartAt, setRetroStartAt] = useState("");
  const reconciledSessionIds = useRef<Set<string>>(new Set());

  const start = useStartSession();
  const pause = usePauseSession();
  const resume = useResumeSession();
  const finish = useFinishSession();
  const updateManual = useUpdateSessionManual();

  const live = useLiveElapsed(activeSession);

  useEffect(() => {
    setNotes(activeSession?.notes ?? "");
  }, [activeSession?.id]);

  // "Continuar exatamente de onde estava" ao reabrir é o comportamento padrão (silencioso) — só
  // interrompe pra perguntar quando a sessão claramente parece esquecida: começou num dia de
  // calendário anterior, ou já passou do limiar de sessão longa (16h).
  useEffect(() => {
    if (!activeSession) return;
    if (reconciledSessionIds.current.has(activeSession.id)) return;

    const checkIn = new Date(activeSession.checkIn);
    const staleDay = !isSameLocalDay(checkIn, new Date());

    if (staleDay || activeSession.isLongRunning) {
      setReconcileOpen(true);
    } else {
      reconciledSessionIds.current.add(activeSession.id);
    }
  }, [activeSession?.id, activeSession?.isLongRunning]);

  function handleContinueSession() {
    if (activeSession) reconciledSessionIds.current.add(activeSession.id);
    setReconcileOpen(false);
  }

  function handleFinishFromReconcile() {
    if (!activeSession) return;
    reconciledSessionIds.current.add(activeSession.id);
    setReconcileOpen(false);
    handleFinish();
  }

  const anyModalOpen = editingCheckIn || reconcileOpen || !!summarySession || showCompletion || !!placementModal;

  // Espaço inicia/pausa/retoma, Esc finaliza — só quando nenhum modal está aberto e o foco não
  // está num campo de texto (senão espaço/esc atrapalhariam digitação nas observações).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (anyModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!activeSession) {
          if (selectedJobId) handleStart();
        } else if (activeSession.status === "RUNNING") {
          pause.mutate(activeSession.id);
        } else if (activeSession.status === "PAUSED") {
          resume.mutate(activeSession.id);
        }
      } else if (e.key === "Escape") {
        if (activeSession) {
          e.preventDefault();
          handleFinish();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModalOpen, activeSession, selectedJobId, retroStartAt]);

  const activeJobs = useMemo(() => (jobs ?? []).filter((j) => j.active), [jobs]);
  const selectedJob = activeSession?.job ?? activeJobs.find((j) => j.id === selectedJobId) ?? null;

  const { todaySeconds, monthSeconds } = useMemo(() => {
    const now = new Date();
    let today = 0;
    let month = 0;
    for (const s of sessions ?? []) {
      if (s.status !== "COMPLETED") continue;
      const checkIn = new Date(s.checkIn);
      if (isSameLocalDay(checkIn, now)) today += s.netSeconds;
      if (isSameLocalMonth(checkIn, now)) month += s.netSeconds;
    }
    if (activeSession && live) {
      const checkIn = new Date(activeSession.checkIn);
      if (isSameLocalDay(checkIn, now)) today += live.netSeconds;
      if (isSameLocalMonth(checkIn, now)) month += live.netSeconds;
    }
    return { todaySeconds: today, monthSeconds: month };
  }, [sessions, activeSession, live]);

  const handleStart = () => {
    if (!selectedJobId) return;
    const checkIn = retroStartAt ? new Date(retroStartAt).toISOString() : undefined;
    start.mutate(
      { jobId: selectedJobId, checkIn },
      {
        onSuccess: () => {
          setRetroStartAt("");
          setShowRetroStart(false);
        },
      },
    );
  };

  const handleFinish = () => {
    if (!activeSession) return;
    finish.mutate(
      { id: activeSession.id, notes },
      {
        onSuccess: (finished) => {
          setShowCompletion(true);
          setTimeout(() => {
            setShowCompletion(false);
            // A colocação vem ANTES do resumo, e o resumo espera a resposta: os dois são modais, e
            // abrir os dois de uma vez empilharia um em cima do outro. Sem sistema de colocação o
            // `askIfNeeded` chama o callback na hora e nada muda pra quem já usava a tela.
            askIfNeeded(finished, () => setSummarySession(finished));
          }, 900);
        },
      },
    );
  };

  if (activeLoading || jobsLoading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!activeSession && activeJobs.length === 0) {
    return (
      <EmptyState
        icon={<Timer className="h-7 w-7" />}
        title="Nenhum trabalho cadastrado"
        description="Cadastre um trabalho fixo ou freelance em 'Trabalhos' antes de iniciar o cronômetro."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PendingPaymentBanner />

      <button
        type="button"
        onClick={() => setAddPastOpen(true)}
        className="flex items-center justify-center gap-1.5 self-center text-xs font-medium text-muted transition-colors hover:text-violet-500"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Adicionar sessão retroativa
      </button>

      {selectedJob && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-lg font-bold">{selectedJob.name}</p>
              <p className="text-sm text-muted">
                {selectedJob.company}
                {selectedJob.client ? ` · ${selectedJob.client}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedJob.type === "FREELANCE" ? (
                <div>
                  <p className="text-xs text-muted">Valor combinado</p>
                  <p className="font-semibold">{formatCurrency(selectedJob.totalAgreedValue ?? 0, selectedJob.currency)}</p>
                  {selectedJob.currency === "USD" && selectedJob.totalAgreedValueBRL != null && (
                    <p className="text-xs text-muted">≈ {formatCurrency(selectedJob.totalAgreedValueBRL)} hoje</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted">Valor mensal</p>
                  <p className="font-semibold">{formatCurrency(selectedJob.monthlyValue ?? 0, selectedJob.currency)}</p>
                  {selectedJob.currency === "USD" && selectedJob.monthlyValueBRL != null && (
                    <p className="text-xs text-muted">≈ {formatCurrency(selectedJob.monthlyValueBRL)} hoje</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-muted">{selectedJob.type === "FREELANCE" ? "Valor atual/hora" : "Valor estimado/hora"}</p>
                <p className="font-semibold">{formatCurrency(activeSession?.hourlyRate ?? selectedJob.estimatedHourlyRate ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Tempo hoje</p>
                <p className="font-semibold">{formatHMS(todaySeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Tempo no mês</p>
                <p className="font-semibold">{formatHMS(monthSeconds)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeSession && (
        <div className="flex flex-col gap-2">
          <Select
            label="Selecione um trabalho"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            options={[{ value: "", label: "Selecione..." }, ...activeJobs.map((j) => ({ value: j.id, label: `${j.name} — ${j.company}` }))]}
          />

          {!showRetroStart ? (
            <button
              type="button"
              onClick={() => setShowRetroStart(true)}
              className="self-start text-xs font-medium text-muted transition-colors hover:text-violet-500"
            >
              Já comecei há um tempo?
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl surface-2 p-3">
              <p className="text-xs font-medium text-muted">Comecei há...</p>
              <div className="flex flex-wrap gap-1.5">
                {[15, 30, 60].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setRetroStartAt(toLocalInputValue(new Date(Date.now() - min * 60_000)))}
                    className="rounded-lg border border-[rgb(var(--border))] px-2.5 py-1 text-xs font-medium transition-colors hover:surface"
                  >
                    {min === 60 ? "1h atrás" : `${min} min atrás`}
                  </button>
                ))}
              </div>
              <Input
                type="datetime-local"
                label="Ou escolha o horário exato"
                value={retroStartAt}
                onChange={(e) => setRetroStartAt(e.target.value)}
                max={toLocalInputValue(new Date())}
              />
              <button
                type="button"
                onClick={() => {
                  setRetroStartAt("");
                  setShowRetroStart(false);
                }}
                className="self-start text-xs text-muted transition-colors hover:text-red-500"
              >
                Cancelar, começar agora
              </button>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <p className="text-center text-xs uppercase tracking-wide text-muted">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>

          <p className="font-mono text-6xl font-bold tabular-nums tracking-tight">{live ? formatHMS(live.netSeconds) : "00:00:00"}</p>

          {activeSession?.status === "PAUSED" && <p className="text-sm font-medium text-amber-500">Pausado</p>}
          {activeSession?.isLongRunning && (
            <p className="text-xs font-medium text-red-500">Essa sessão já passou de 16h — não esqueça de finalizar.</p>
          )}

          {live && (
            <p className="text-sm text-muted">
              Valor da sessão: <span className="font-semibold text-[rgb(var(--text))]">{formatCurrency(live.equivalentValue)}</span>
            </p>
          )}

          {!activeSession && (
            <div className="flex flex-col items-center gap-1.5">
              <Button size="lg" onClick={handleStart} disabled={!selectedJobId} loading={start.isPending}>
                <Play className="h-5 w-5" />
                Iniciar Trabalho
              </Button>
              {retroStartAt && (
                <p className="text-xs text-muted">Início será registrado às {new Date(retroStartAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              )}
            </div>
          )}

          {(!activeSession || activeSession.status !== "COMPLETED") && (
            <p className="hidden text-xs text-muted sm:block">
              Atalhos: <kbd className="rounded border border-[rgb(var(--border))] px-1 py-0.5 font-mono">espaço</kbd>{" "}
              {activeSession ? "pausa/retoma" : "inicia"} ·{" "}
              <kbd className="rounded border border-[rgb(var(--border))] px-1 py-0.5 font-mono">esc</kbd> finaliza
            </p>
          )}

          {activeSession?.status === "RUNNING" && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => pause.mutate(activeSession.id)} loading={pause.isPending}>
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
              <Button variant="danger" onClick={handleFinish} loading={finish.isPending}>
                <Square className="h-4 w-4" />
                Finalizar Trabalho
              </Button>
            </div>
          )}

          {activeSession?.status === "PAUSED" && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => resume.mutate(activeSession.id)} loading={resume.isPending}>
                <Play className="h-4 w-4" />
                Retomar
              </Button>
              <Button variant="danger" onClick={handleFinish} loading={finish.isPending}>
                <Square className="h-4 w-4" />
                Finalizar Trabalho
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {activeSession && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="O que você está fazendo..." />
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Check-in: {new Date(activeSession.checkIn).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button
                type="button"
                className="font-medium text-violet-500 hover:underline"
                onClick={() => {
                  setManualCheckIn(toLocalInputValue(new Date(activeSession.checkIn)));
                  setEditingCheckIn(true);
                }}
              >
                Editar horário
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal open={editingCheckIn} onClose={() => setEditingCheckIn(false)} title="Editar horário de início">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activeSession) return;
            updateManual.mutate(
              { id: activeSession.id, data: { checkIn: new Date(manualCheckIn).toISOString() } },
              { onSuccess: () => setEditingCheckIn(false) },
            );
          }}
        >
          <Input
            type="datetime-local"
            label="Novo horário de check-in"
            value={manualCheckIn}
            onChange={(e) => setManualCheckIn(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingCheckIn(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateManual.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={reconcileOpen} onClose={handleContinueSession} title="Sessão em andamento encontrada">
        {activeSession && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Encontramos uma sessão iniciada em {new Date(activeSession.checkIn).toLocaleString("pt-BR")} que ainda está aberta
              {activeSession.isLongRunning ? " e já passou de 16 horas" : ""}. Deseja continuar de onde parou ou finalizar agora?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleContinueSession}>
                Continuar sessão
              </Button>
              <Button variant="danger" onClick={handleFinishFromReconcile}>
                Finalizar agora
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {showCompletion && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              <Check className="h-12 w-12" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!summarySession} onClose={() => setSummarySession(null)} title="Resumo da sessão">
        {summarySession && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Entrada</p>
                <p className="font-semibold">{new Date(summarySession.checkIn).toLocaleTimeString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Saída</p>
                <p className="font-semibold">{summarySession.checkOut ? new Date(summarySession.checkOut).toLocaleTimeString("pt-BR") : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Tempo bruto</p>
                <p className="font-semibold">{formatHMS(summarySession.grossSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Tempo de pausa</p>
                <p className="font-semibold">{formatHMS(summarySession.pauseSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Tempo líquido</p>
                <p className="font-semibold">{formatHMS(summarySession.netSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Valor equivalente</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(summarySession.equivalentValue)}</p>
              </div>
            </div>
            {summarySession.notes && <p className="text-sm text-muted">Observações: {summarySession.notes}</p>}
            <Button onClick={() => setSummarySession(null)}>Salvar Sessão</Button>
          </div>
        )}
      </Modal>

      {placementModal}

      <AddPastSessionModal open={addPastOpen} onClose={() => setAddPastOpen(false)} />
    </div>
  );
}
