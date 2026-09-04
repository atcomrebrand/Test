import { useState } from "react";
import { MessageCircle, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useCrmTemplates, useRenewSubscription, useSendWhatsapp } from "../api";
import { CrmTemplateCategory } from "../types";

/**
 * As ações que o briefing quer em um clique (§16, §60).
 *
 * A renovação não abre formulário: manda o POST vazio e o servidor herda valor, período e forma de
 * pagamento da assinatura. Quem precisa mudar alguma coisa usa o modal de renovação detalhada — mas
 * o caminho comum, que é "o cliente pagou o de sempre", não custa nem uma tela.
 */

export function RenewButton({
  subscriptionId,
  size = "sm",
  label = "Renovar",
}: {
  subscriptionId: string | undefined;
  size?: "sm" | "md";
  label?: string;
}) {
  const renew = useRenewSubscription();
  if (!subscriptionId) return null;

  return (
    <Button
      size={size}
      variant="secondary"
      disabled={renew.isPending}
      onClick={() => renew.mutate({ id: subscriptionId })}
      className="gap-1.5"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", renew.isPending && "animate-spin")} />
      {label}
    </Button>
  );
}

/**
 * Abre o WhatsApp com a mensagem pronta. Quando há mais de um template da categoria, pergunta qual —
 * caso contrário dispara direto, porque escolher entre uma opção só é clique desperdiçado.
 *
 * O sistema não envia nada: `window.open` leva pro WhatsApp com o texto preenchido e quem aperta
 * "enviar" é a pessoa (§17).
 */
export function WhatsappButton({
  customerId,
  linkId,
  categories,
  label,
  size = "sm",
}: {
  customerId?: string;
  linkId?: string;
  categories?: CrmTemplateCategory[];
  label?: string;
  size?: "sm" | "md";
}) {
  const { data: templates } = useCrmTemplates();
  const send = useSendWhatsapp();
  const [picking, setPicking] = useState(false);

  const forReseller = Boolean(linkId);
  const candidates = (templates ?? []).filter(
    (t) => t.active && t.forReseller === forReseller && (!categories || categories.includes(t.category)),
  );

  const dispatch = (templateId: string) => {
    send.mutate({ templateId, customerId, linkId });
    setPicking(false);
  };

  return (
    <>
      <Button
        size={size}
        variant="secondary"
        disabled={send.isPending || candidates.length === 0}
        title={candidates.length === 0 ? "Nenhum template pra essa situação" : undefined}
        onClick={() => (candidates.length === 1 ? dispatch(candidates[0].id) : setPicking(true))}
        className="gap-1.5"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {label ?? "WhatsApp"}
      </Button>

      <Modal open={picking} onClose={() => setPicking(false)} title="Qual mensagem?">
        <div className="flex flex-col gap-2">
          {candidates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => dispatch(t.id)}
              className="surface-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-indigo-500/10"
            >
              <p className="text-sm font-medium">{t.name}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p>
            </button>
          ))}
          <p className="mt-1 text-xs text-muted">
            O sistema abre a conversa com o texto pronto. O envio é sempre você que faz.
          </p>
        </div>
      </Modal>
    </>
  );
}

/** Botão de recarga rápida do revendedor (§41). */
export function RechargeButton({ onClick, size = "sm" }: { onClick: () => void; size?: "sm" | "md" }) {
  return (
    <Button size={size} onClick={onClick} className="gap-1.5">
      <Zap className="h-3.5 w-3.5" />
      Recarga
    </Button>
  );
}
