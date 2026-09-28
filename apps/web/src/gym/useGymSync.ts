import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sessionPayload, useGymSessionStore } from "./store/session";
import { GymSessionDetail } from "./types";

/**
 * Sobe as sessões finalizadas que ainda estão no aparelho.
 *
 * Tenta ao montar, quando a rede volta e quando a aba reaparece — que são os três momentos em que
 * um treino guardado no vestiário sem sinal pode finalmente subir. Falha em silêncio de propósito:
 * a sessão continua na fila e o app continua funcionando. Perder o treino porque a academia não
 * tem sinal é o pior desfecho possível aqui, e é o que essa fila existe pra impedir.
 *
 * A subida é idempotente pelo `clientId`, então tentar de novo nunca duplica.
 */
export function useGymSync() {
  const pending = useGymSessionStore((s) => s.pending);
  const markSynced = useGymSessionStore((s) => s.markSynced);
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const rodando = useRef(false);

  useEffect(() => {
    if (pending.length === 0) return;

    async function subir() {
      if (rodando.current) return;
      rodando.current = true;
      setSyncing(true);
      try {
        for (const sessao of useGymSessionStore.getState().pending) {
          try {
            const salva = await api.post<GymSessionDetail>("/gym/sessions", sessionPayload(sessao));
            // Os recordes vêm na resposta da subida: quem sabe o que foi superado é o servidor,
            // que tem o histórico inteiro — o aparelho só conhece o treino de hoje.
            markSynced(sessao.clientId, salva.newRecords ?? []);
          } catch {
            // Sem rede ou servidor fora: para por aqui e tenta na próxima oportunidade.
            break;
          }
        }
        qc.invalidateQueries({ queryKey: ["gym"] });
      } finally {
        rodando.current = false;
        setSyncing(false);
      }
    }

    void subir();
    window.addEventListener("online", subir);
    document.addEventListener("visibilitychange", subir);
    return () => {
      window.removeEventListener("online", subir);
      document.removeEventListener("visibilitychange", subir);
    };
  }, [pending.length, markSynced, qc]);

  return { pendingCount: pending.length, syncing };
}

/** Se o navegador diz que está sem rede. Só pra avisar — nada no treino depende disso. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
