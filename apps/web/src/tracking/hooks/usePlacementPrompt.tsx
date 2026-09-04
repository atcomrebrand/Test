import { useState } from "react";
import { useUpdateSessionManual } from "../api";
import { PlacementModal, PlacementValues } from "../components/PlacementModal";
import { TrackingSession } from "../types";

/**
 * A pergunta da colocação, compartilhada pelos dois lugares onde se encerra uma sessão: o ✓ da
 * barra flutuante (que aparece em qualquer tela do módulo) e o "Finalizar" do Modo Foco.
 *
 * Estar nos dois é o ponto: se só o Modo Foco perguntasse, o botão rápido pularia a pergunta em
 * silêncio e o dia ficaria sem o número sem ninguém perceber.
 *
 * **A sessão é encerrada ANTES de perguntar**, e a resposta entra depois por edição. O check-out
 * tem que marcar a hora em que se clicou em finalizar — perguntar primeiro deixaria o cronômetro
 * correndo enquanto a pessoa digita, e o dia terminaria com alguns minutos a mais que não foram
 * trabalhados.
 */
export function usePlacementPrompt() {
  const [pendente, setPendente] = useState<{ session: TrackingSession; onResolved?: () => void } | null>(null);
  const atualizar = useUpdateSessionManual();

  /**
   * Chamar com a sessão recém-encerrada: abre a pergunta só se o trabalho tiver o sistema.
   *
   * `onResolved` roda quando a pergunta sai da tela — respondida OU pulada — e roda na hora quando
   * o trabalho não tem colocação. É o que deixa quem chama continuar o próprio fluxo (o Modo Foco
   * abre o resumo depois) sem precisar saber se a pergunta chegou a aparecer.
   */
  function askIfNeeded(finished: TrackingSession, onResolved?: () => void) {
    if (finished.job?.tracksPlacement) setPendente({ session: finished, onResolved });
    else onResolved?.();
  }

  function fechar() {
    pendente?.onResolved?.();
    setPendente(null);
  }

  const modal = pendente ? (
    <PlacementModal
      open
      jobName={pendente.session.job.name}
      loading={atualizar.isPending}
      onSkip={fechar}
      onConfirm={(values: PlacementValues) =>
        atualizar.mutate({ id: pendente.session.id, data: { ...values } }, { onSuccess: fechar })
      }
    />
  ) : null;

  return { askIfNeeded, placementModal: modal };
}
