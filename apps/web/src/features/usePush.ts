import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS only ever delivers Web Push to a PWA running in standalone mode (added to the Home
 *  Screen) — a plain Safari tab can request permission and "succeed" at subscribing, but iOS
 *  silently never invokes the push service worker. Detecting this lets the UI explain it instead
 *  of leaving the user wondering why notifications never arrive. */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/** Raw browser permission state — "denied" here means the OS/browser already decided and
 *  Notification.requestPermission() will never show a prompt again; only the user going into their
 *  device's own notification settings can undo that. Surfacing this directly helps tell apart
 *  "never asked", "asked and refused", and "granted but something else is wrong". */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function usePushStatus() {
  return useQuery({
    queryKey: ["push", "status"],
    queryFn: () => api.get<{ subscribed: boolean }>("/push/status"),
    enabled: isPushSupported(),
  });
}

async function subscribeFresh() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notificações negadas nas configurações do aparelho. Vá em Ajustes > Notificações e ative manualmente."
        : "Permissão de notificação negada.",
    );
  }

  const { publicKey } = await api.get<{ publicKey: string | null }>("/push/vapid-public-key");
  if (!publicKey) throw new Error("Servidor ainda não configurou as chaves de notificação (VAPID).");

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
}

export function useSubscribePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscribeFresh,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push", "status"] }),
  });
}

export function useUnsubscribePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      } else {
        // The browser lost track of its own subscription (PWA reinstalled, site data cleared,
        // etc) — nothing local to unsubscribe from, so clear server state directly instead of
        // leaving the "Desativar" button stuck forever showing "subscribed".
        await api.post("/push/reset");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push", "status"] }),
  });
}

export function useSendTestPush() {
  return useMutation({ mutationFn: () => api.post("/push/test") });
}

/** Hard reset: clears any existing subscription (server + local) and subscribes fresh from
 *  scratch. This is the fix for a subscription that the server happily sends to (200/201, no
 *  errors) but that never actually shows up on the device — a stale registration left over from
 *  before the PWA was reinstalled, for instance. Also doubles as a way to surface the real
 *  Notification.requestPermission() result when things aren't working: "denied" here means the OS
 *  already decided and only the device's own settings can undo it, not this button. */
export function useResubscribePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      await api.post("/push/reset");
      await subscribeFresh();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push", "status"] }),
  });
}
