import { useEffect, useState } from "react";

/**
 * Devolve o instante atual, redesenhando na frequência pedida.
 *
 * O `setInterval` daqui **não conta nada** — ele só provoca o redesenho. Todo o tempo mostrado sai
 * de `agora - instanteGuardado`, então um intervalo atrasado, suspenso pelo navegador ou perdido
 * enquanto a tela estava apagada não erra o relógio: assim que ele voltar a rodar, o número já sai
 * certo. É essa separação que faz o cronômetro sobreviver ao segundo plano (§12).
 *
 * Volta a acertar na hora em que a aba reaparece, sem esperar o próximo intervalo — meio segundo de
 * número velho depois de destravar o celular é justamente o que faria alguém desconfiar do timer.
 */
export function useElapsed(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const aoVoltar = () => setNow(Date.now());
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [active, intervalMs]);

  return now;
}
