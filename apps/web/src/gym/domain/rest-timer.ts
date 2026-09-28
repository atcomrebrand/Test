/**
 * O cronômetro de descanso.
 *
 * Esta é a peça mais importante do módulo, e a regra que a sustenta é uma só: **o estado guarda um
 * instante, nunca um contador**. Enquanto roda, o que existe é `endsAt` — o horário em que o
 * descanso acaba. O tempo restante é sempre `endsAt - agora`, calculado na hora de mostrar.
 *
 * Por que isso importa: um `setInterval` que decrementa um número é suspenso pelo navegador quando
 * a tela apaga ou o app vai pro segundo plano. Quem conta assim volta de 20 segundos de bolso com
 * 20 segundos a menos descontados — o cronômetro "atrasa" exatamente na hora em que a pessoa mais
 * confia nele. Com timestamp não existe atraso possível: se o app ficou fora por 20s, a diferença
 * já reflete isso na primeira vez que alguém perguntar.
 *
 * O `setInterval` continua existindo na tela, mas só pra **redesenhar**. Se ele atrasar, pular ou
 * parar, o número mostrado continua certo assim que rodar de novo.
 *
 * Tudo aqui é função pura, sem `Date.now()` por dentro: quem chama passa o `now`. É o que torna
 * possível testar segundo plano, tela bloqueada e reabertura do app sem esperar tempo real passar.
 */

export type RestPhase = "IDLE" | "RUNNING" | "PAUSED" | "FINISHED";

export interface RestTimerState {
  phase: RestPhase;
  /** Duração configurada para este descanso, já com os ajustes manuais aplicados (ms). */
  durationMs: number;
  /** Quando o descanso termina. Só existe em RUNNING — é o coração do cronômetro. */
  endsAt: number | null;
  /** Restante congelado durante a pausa. Só existe em PAUSED. */
  pausedRemainingMs: number | null;
  /** Quando o descanso começou, pro registro da série (§37). */
  startedAt: number | null;
  /** Quando parou de valer — por chegar a zero, por ser pulado ou por ser finalizado à mão. */
  endedAt: number | null;
  /** Soma dos ajustes manuais (+15s/-15s/editar), em ms. Positivo = estendeu. */
  adjustmentMs: number;
  wasPaused: boolean;
  wasSkipped: boolean;
}

export const IDLE_REST: RestTimerState = {
  phase: "IDLE",
  durationMs: 0,
  endsAt: null,
  pausedRemainingMs: null,
  startedAt: null,
  endedAt: null,
  adjustmentMs: 0,
  wasPaused: false,
  wasSkipped: false,
};

/** Começa o descanso. `seconds` é o configurado para aquele exercício. */
export function startRest(seconds: number, now: number): RestTimerState {
  const durationMs = Math.max(0, Math.round(seconds * 1000));
  return {
    ...IDLE_REST,
    phase: durationMs === 0 ? "FINISHED" : "RUNNING",
    durationMs,
    endsAt: durationMs === 0 ? null : now + durationMs,
    startedAt: now,
    endedAt: durationMs === 0 ? now : null,
  };
}

/**
 * Quanto falta, em ms, nunca negativo.
 *
 * É a única fonte do número que aparece na tela. Em PAUSED devolve o congelado; em RUNNING, a
 * diferença até `endsAt` — que já embute qualquer tempo que o app tenha passado suspenso.
 */
export function remainingMs(state: RestTimerState, now: number): number {
  if (state.phase === "PAUSED") return Math.max(0, state.pausedRemainingMs ?? 0);
  if (state.phase === "RUNNING" && state.endsAt !== null) return Math.max(0, state.endsAt - now);
  return 0;
}

/** Quanto já passou, pra barra de progresso. */
export function elapsedMs(state: RestTimerState, now: number): number {
  if (state.phase === "IDLE") return 0;
  return Math.max(0, state.durationMs - remainingMs(state, now));
}

/** 0 a 1. Duração zero conta como completo, senão a barra ficaria vazia pra sempre. */
export function progress(state: RestTimerState, now: number): number {
  if (state.durationMs <= 0) return 1;
  return Math.min(1, elapsedMs(state, now) / state.durationMs);
}

/**
 * Faz o tempo "acontecer": leva RUNNING pra FINISHED quando o instante já passou.
 *
 * Chamada a cada quadro e também ao voltar do segundo plano. É aqui que 20 segundos de tela apagada
 * viram um descanso concluído — e não numa contagem que ficou parada.
 *
 * Devolve o MESMO objeto quando nada mudou, pra não disparar re-render à toa (§51).
 */
export function settleRest(state: RestTimerState, now: number): RestTimerState {
  if (state.phase !== "RUNNING") return state;
  if (state.endsAt === null || now < state.endsAt) return state;
  return { ...state, phase: "FINISHED", endsAt: state.endsAt, endedAt: state.endsAt };
}

export function pauseRest(state: RestTimerState, now: number): RestTimerState {
  if (state.phase !== "RUNNING") return state;
  return {
    ...state,
    phase: "PAUSED",
    pausedRemainingMs: remainingMs(state, now),
    endsAt: null,
    wasPaused: true,
  };
}

/** Continua de onde parou: o restante congelado vira um novo instante de término. */
export function resumeRest(state: RestTimerState, now: number): RestTimerState {
  if (state.phase !== "PAUSED") return state;
  const restante = state.pausedRemainingMs ?? 0;
  if (restante <= 0) return { ...state, phase: "FINISHED", pausedRemainingMs: null, endedAt: now };
  return { ...state, phase: "RUNNING", endsAt: now + restante, pausedRemainingMs: null };
}

/**
 * +15s / -15s / editar tempo.
 *
 * Funciona rodando E pausado, porque durante a pausa é justamente quando dá tempo de pensar "vou
 * precisar de mais um pouco". Tirar mais do que resta não vira tempo negativo: zera e o descanso
 * termina na próxima passada.
 *
 * Um descanso já FINALIZADO pode ser estendido — é o "ainda não me recuperei" logo depois do aviso.
 * Estender revive o cronômetro; encurtar um já finalizado não faz nada.
 */
export function adjustRest(state: RestTimerState, deltaSeconds: number, now: number): RestTimerState {
  if (state.phase === "IDLE") return state;
  const deltaMs = Math.round(deltaSeconds * 1000);
  const duracao = Math.max(0, state.durationMs + deltaMs);
  const ajuste = state.adjustmentMs + deltaMs;

  if (state.phase === "PAUSED") {
    return {
      ...state,
      durationMs: duracao,
      adjustmentMs: ajuste,
      pausedRemainingMs: Math.max(0, (state.pausedRemainingMs ?? 0) + deltaMs),
    };
  }

  if (state.phase === "FINISHED") {
    if (deltaMs <= 0) return state;
    return { ...state, phase: "RUNNING", durationMs: duracao, adjustmentMs: ajuste, endsAt: now + deltaMs, endedAt: null };
  }

  const novoFim = Math.max(now, (state.endsAt ?? now) + deltaMs);
  return { ...state, durationMs: duracao, adjustmentMs: ajuste, endsAt: novoFim };
}

/** Troca a duração inteira ("editar tempo"), preservando quanto já passou. */
export function setRestDuration(state: RestTimerState, seconds: number, now: number): RestTimerState {
  const alvoMs = Math.max(0, Math.round(seconds * 1000));
  return adjustRest(state, (alvoMs - state.durationMs) / 1000, now);
}

/** Pular: encerra na hora, sem confirmação (§16). Fica marcado como pulado pro registro. */
export function skipRest(state: RestTimerState, now: number): RestTimerState {
  if (state.phase === "IDLE") return state;
  return { ...state, phase: "FINISHED", endsAt: null, pausedRemainingMs: null, endedAt: now, wasSkipped: true };
}

/** Finalizar à mão a partir da pausa — o mesmo que pular, mas sem marcar como pulado. */
export function finishRest(state: RestTimerState, now: number): RestTimerState {
  if (state.phase === "IDLE" || state.phase === "FINISHED") return state;
  return { ...state, phase: "FINISHED", endsAt: null, pausedRemainingMs: null, endedAt: now };
}

/**
 * O que vai pro registro da série (§37).
 *
 * `actualSeconds` é tempo de relógio do começo ao fim, **incluindo a pausa**: se a pessoa pausou e
 * ficou 3 minutos conversando, ela descansou 3 minutos — é isso que a estatística de descanso
 * precisa saber, não o que o cronômetro teria contado.
 */
export interface RestRecord {
  restSeconds: number;
  restStartedAt: string;
  restEndedAt: string;
  restActualSeconds: number;
  restWasPaused: boolean;
  restWasSkipped: boolean;
  restAdjustmentSeconds: number;
}

export function restRecordOf(state: RestTimerState, now: number): RestRecord | null {
  if (state.startedAt === null) return null;
  const fim = state.endedAt ?? now;
  return {
    restSeconds: Math.round(state.durationMs / 1000),
    restStartedAt: new Date(state.startedAt).toISOString(),
    restEndedAt: new Date(fim).toISOString(),
    restActualSeconds: Math.max(0, Math.round((fim - state.startedAt) / 1000)),
    restWasPaused: state.wasPaused,
    restWasSkipped: state.wasSkipped,
    restAdjustmentSeconds: Math.round(state.adjustmentMs / 1000),
  };
}

/** "01:30". Minutos sem zero à esquerda acima de 60 min não acontece num descanso, mas o formato
 *  aguenta caso alguém edite pra 90 minutos. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/** As opções fixas do seletor (§8), em segundos. */
export const REST_PRESETS = [15, 30, 45, 60, 75, 90, 120, 150, 180] as const;
