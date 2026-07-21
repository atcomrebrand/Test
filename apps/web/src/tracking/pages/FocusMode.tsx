import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Square, Check, Timer } from "lucide-react";
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
import { useLiveElapsed } from "../hooks/useLiveElapsed";
import { formatHMS, isSameLocalDay, isSameLocalMonth } from "../lib/sessionTime";
import { TrackingSession } from "../types";

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
  const [editingCheckIn, setEditingCheckIn] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState("");
  const [reconcileOpen, setReconcileOpen] = useState(false);
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
    start.mutate({ jobId: selectedJobId });
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
            setSummarySession(finished);
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
        title="Nenhum trabalho fixo cadastrado"
        description="Cadastre um trabalho fixo em 'Trabalhos' antes de iniciar o cronômetro."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
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
              <div>
                <p className="text-xs text-muted">Valor mensal</p>
                <p className="font-semibold">{formatCurrency(selectedJob.monthlyValue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Valor estimado/hora</p>
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
        <Select
          label="Selecione um trabalho fixo"
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          options={[{ value: "", label: "Selecione..." }, ...activeJobs.map((j) => ({ value: j.id, label: `${j.name} — ${j.company}` }))]}
        />
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
            <Button size="lg" onClick={handleStart} disabled={!selectedJobId} loading={start.isPending}>
              <Play className="h-5 w-5" />
              Iniciar Trabalho
            </Button>
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
    </div>
  );
}
