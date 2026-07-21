import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { BellRing, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isIos, isPushSupported, isStandalone, usePushStatus, useSendTestPush, useSubscribePush, useUnsubscribePush } from "@/features/usePush";
import { useRegisterFaceId, useRemoveWebAuthnCredential, useWebAuthnCredentials } from "@/features/useWebAuthn";

export function SecuritySettingsCard() {
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  useEffect(() => setWebauthnSupported(browserSupportsWebAuthn()), []);

  const pushSupported = isPushSupported();
  const iosNotInstalled = isIos() && !isStandalone();

  const { data: pushStatus } = usePushStatus();
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const sendTestPush = useSendTestPush();

  const { data: credentials } = useWebAuthnCredentials();
  const registerFaceId = useRegisterFaceId();
  const removeCredential = useRemoveWebAuthnCredential();

  function onTogglePush() {
    if (pushStatus?.subscribed) {
      unsubscribePush.mutate(undefined, {
        onSuccess: () => toast.success("Notificações desativadas."),
        onError: (e: Error) => toast.error(e.message),
      });
    } else {
      subscribePush.mutate(undefined, {
        onSuccess: () => toast.success("Notificações ativadas!"),
        onError: (e: Error) => toast.error(e.message),
      });
    }
  }

  function onRegisterFaceId() {
    registerFaceId.mutate(undefined, {
      onSuccess: () => toast.success("Face ID/Touch ID cadastrado neste aparelho!"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segurança e notificações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="h-4 w-4" /> Notificações push
          </div>
          {!pushSupported ? (
            <p className="mt-2 text-xs text-muted">Seu navegador não suporta notificações push.</p>
          ) : iosNotInstalled ? (
            <p className="mt-2 text-xs text-muted">
              No iPhone, notificações só funcionam com o app adicionado à Tela de Início. Toque em{" "}
              <span className="font-medium">Compartilhar</span> no Safari e depois em{" "}
              <span className="font-medium">Adicionar à Tela de Início</span>, então abra o app por esse ícone e volte aqui.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                variant={pushStatus?.subscribed ? "outline" : "primary"}
                size="sm"
                loading={subscribePush.isPending || unsubscribePush.isPending}
                onClick={onTogglePush}
              >
                {pushStatus?.subscribed ? "Desativar notificações" : "Ativar notificações"}
              </Button>
              {pushStatus?.subscribed && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={sendTestPush.isPending}
                  onClick={() => sendTestPush.mutate(undefined, { onError: (e: Error) => toast.error(e.message) })}
                >
                  Enviar teste
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[rgb(var(--border))] pt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ScanFace className="h-4 w-4" /> Face ID / Touch ID para entrar
          </div>
          {!webauthnSupported ? (
            <p className="mt-2 text-xs text-muted">Seu navegador não suporta login biométrico (WebAuthn).</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                Cadastre este aparelho para entrar com reconhecimento facial ou digital, sem digitar a senha.
              </p>
              <div className="mt-3 space-y-2">
                {credentials?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="h-4 w-4 text-muted" />
                      <span>{c.name || "Aparelho cadastrado"}</span>
                    </div>
                    <button
                      onClick={() =>
                        removeCredential.mutate(c.id, {
                          onSuccess: () => toast.success("Removido."),
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                      className="text-muted hover:text-red-500"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" loading={registerFaceId.isPending} onClick={onRegisterFaceId}>
                <ScanFace className="h-4 w-4" /> Ativar Face ID/Touch ID neste aparelho
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
