import { describe, expect, it } from "vitest";
import {
  adjustRest,
  elapsedMs,
  finishRest,
  formatClock,
  pauseRest,
  progress,
  remainingMs,
  restRecordOf,
  resumeRest,
  settleRest,
  setRestDuration,
  skipRest,
  startRest,
} from "./rest-timer";

/** Um instante qualquer, fixo. Nenhum teste aqui espera tempo real passar: o `now` é argumento. */
const T0 = 1_800_000_000_000;
const s = (n: number) => n * 1000;

describe("cronômetro de descanso", () => {
  it("começa contando a partir do tempo configurado", () => {
    const t = startRest(90, T0);
    expect(t.phase).toBe("RUNNING");
    expect(remainingMs(t, T0)).toBe(s(90));
    expect(formatClock(remainingMs(t, T0))).toBe("01:30");
  });

  it("desconta o tempo que passou, não o número de vezes que foi consultado", () => {
    const t = startRest(90, T0);
    expect(formatClock(remainingMs(t, T0 + s(13)))).toBe("01:17");
    // Consultar dez vezes o mesmo instante dá a mesma resposta — não existe contador pra andar.
    expect(remainingMs(t, T0 + s(13))).toBe(remainingMs(t, T0 + s(13)));
  });

  it("SEGUNDO PLANO: 20s de app fora do ar somem do descanso, sem contador nenhum rodando", () => {
    // O caso do §12. Entre estas duas linhas o navegador suspendeu tudo: nenhum tick aconteceu.
    const t = startRest(90, T0);
    const aoVoltar = settleRest(t, T0 + s(20));
    expect(aoVoltar.phase).toBe("RUNNING");
    expect(remainingMs(aoVoltar, T0 + s(20))).toBe(s(70));
  });

  it("TELA BLOQUEADA por mais tempo que o descanso: volta já finalizado, não com tempo sobrando", () => {
    const t = startRest(90, T0);
    const aoVoltar = settleRest(t, T0 + s(200));
    expect(aoVoltar.phase).toBe("FINISHED");
    expect(remainingMs(aoVoltar, T0 + s(200))).toBe(0);
    // E o fim registrado é quando o tempo REALMENTE acabou, não quando o app voltou.
    expect(aoVoltar.endedAt).toBe(T0 + s(90));
  });

  it("REABRIR O APP: o estado guardado no aparelho continua válido, porque é um instante", () => {
    const antes = startRest(90, T0);
    // O que vai pro localStorage e volta depois — só dados, sem timer vivo.
    const restaurado = JSON.parse(JSON.stringify(antes));
    expect(remainingMs(restaurado, T0 + s(45))).toBe(s(45));
    expect(settleRest(restaurado, T0 + s(91)).phase).toBe("FINISHED");
  });

  it("settle não cria objeto novo quando nada mudou (evita re-render a cada quadro)", () => {
    const t = startRest(90, T0);
    expect(settleRest(t, T0 + s(10))).toBe(t);
  });

  it("pausa congela o restante e o tempo para de correr de verdade", () => {
    const pausado = pauseRest(startRest(90, T0), T0 + s(30));
    expect(pausado.phase).toBe("PAUSED");
    expect(remainingMs(pausado, T0 + s(30))).toBe(s(60));
    // Cinco minutos depois, ainda 60s: pausado é pausado.
    expect(remainingMs(pausado, T0 + s(330))).toBe(s(60));
    expect(settleRest(pausado, T0 + s(330)).phase).toBe("PAUSED");
  });

  it("continuar recomeça do restante congelado, e não de onde teria chegado", () => {
    const pausado = pauseRest(startRest(90, T0), T0 + s(30));
    const voltou = resumeRest(pausado, T0 + s(300));
    expect(voltou.phase).toBe("RUNNING");
    expect(remainingMs(voltou, T0 + s(300))).toBe(s(60));
    expect(settleRest(voltou, T0 + s(360)).phase).toBe("FINISHED");
  });

  it("+15s estende e -15s encurta, rodando", () => {
    let t = startRest(90, T0);
    t = adjustRest(t, 15, T0 + s(10));
    expect(remainingMs(t, T0 + s(10))).toBe(s(95));
    t = adjustRest(t, -15, T0 + s(10));
    expect(remainingMs(t, T0 + s(10))).toBe(s(80));
    expect(t.adjustmentMs).toBe(0);
  });

  it("ajuste também vale PAUSADO — é quando dá tempo de perceber que precisa de mais", () => {
    const pausado = pauseRest(startRest(90, T0), T0 + s(60));
    const maior = adjustRest(pausado, 30, T0 + s(60));
    expect(maior.phase).toBe("PAUSED");
    expect(remainingMs(maior, T0 + s(60))).toBe(s(60));
  });

  it("tirar mais tempo do que resta zera, sem virar tempo negativo", () => {
    const t = adjustRest(startRest(30, T0), -60, T0 + s(5));
    expect(remainingMs(t, T0 + s(5))).toBe(0);
    expect(settleRest(t, T0 + s(5)).phase).toBe("FINISHED");
  });

  it("editar o tempo troca a duração preservando o que já passou", () => {
    // 01:30 configurado, 30s já corridos; editar pra 02:00 deixa 90s restantes.
    const t = setRestDuration(startRest(90, T0), 120, T0 + s(30));
    expect(t.durationMs).toBe(s(120));
    expect(remainingMs(t, T0 + s(30))).toBe(s(90));
  });

  it("pular encerra na hora e fica marcado como pulado", () => {
    const t = skipRest(startRest(90, T0), T0 + s(12));
    expect(t.phase).toBe("FINISHED");
    expect(t.wasSkipped).toBe(true);
    expect(remainingMs(t, T0 + s(12))).toBe(0);
  });

  it("finalizar à mão encerra sem marcar como pulado", () => {
    const t = finishRest(pauseRest(startRest(90, T0), T0 + s(20)), T0 + s(25));
    expect(t.phase).toBe("FINISHED");
    expect(t.wasSkipped).toBe(false);
    expect(t.wasPaused).toBe(true);
  });

  it("descanso já finalizado pode ser estendido, mas não encurtado", () => {
    const acabou = settleRest(startRest(90, T0), T0 + s(90));
    const mais = adjustRest(acabou, 15, T0 + s(95));
    expect(mais.phase).toBe("RUNNING");
    expect(remainingMs(mais, T0 + s(95))).toBe(s(15));
    expect(adjustRest(acabou, -15, T0 + s(95))).toBe(acabou);
  });

  it("descanso de 0s nasce finalizado — é o 'nenhum descanso' entre exercícios (§17)", () => {
    const t = startRest(0, T0);
    expect(t.phase).toBe("FINISHED");
    expect(progress(t, T0)).toBe(1);
  });

  it("progresso vai de 0 a 1 e não passa disso mesmo estourando o tempo", () => {
    const t = startRest(90, T0);
    expect(progress(t, T0)).toBe(0);
    expect(progress(t, T0 + s(45))).toBeCloseTo(0.5, 5);
    expect(progress(t, T0 + s(400))).toBe(1);
    expect(elapsedMs(t, T0 + s(400))).toBe(s(90));
  });

  it("o registro conta o descanso de RELÓGIO, incluindo a pausa", () => {
    // Pausou aos 30s, ficou 5 minutos parado, voltou e deixou terminar.
    const pausado = pauseRest(startRest(90, T0), T0 + s(30));
    const voltou = resumeRest(pausado, T0 + s(330));
    const fim = settleRest(voltou, T0 + s(390));
    const reg = restRecordOf(fim, T0 + s(390))!;

    expect(reg.restSeconds).toBe(90);
    // Descansou 6,5 minutos de verdade — é isso que a estatística precisa, não os 90s configurados.
    expect(reg.restActualSeconds).toBe(390);
    expect(reg.restWasPaused).toBe(true);
    expect(reg.restWasSkipped).toBe(false);
    expect(reg.restAdjustmentSeconds).toBe(0);
  });

  it("o registro guarda o ajuste manual, com sinal", () => {
    const t = adjustRest(startRest(90, T0), 30, T0 + s(5));
    const reg = restRecordOf(skipRest(t, T0 + s(10)), T0 + s(10))!;
    expect(reg.restAdjustmentSeconds).toBe(30);
    expect(reg.restSeconds).toBe(120);
    expect(reg.restWasSkipped).toBe(true);
  });

  it("sem descanso iniciado não há registro", () => {
    expect(restRecordOf(startRest(0, T0), T0)).not.toBeNull();
    expect(restRecordOf({ ...startRest(90, T0), startedAt: null }, T0)).toBeNull();
  });

  it("formata o relógio com dois dígitos e arredonda pra cima", () => {
    expect(formatClock(s(90))).toBe("01:30");
    expect(formatClock(s(9))).toBe("00:09");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-500)).toBe("00:00");
    // 1ms restante ainda é "00:01" na tela: mostrar 00:00 com tempo sobrando parece travado.
    expect(formatClock(1)).toBe("00:01");
  });
});
