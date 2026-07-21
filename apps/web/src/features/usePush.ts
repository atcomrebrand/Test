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

export function usePushStatus() {
  return useQuery({
    queryKey: ["push", "status"],
    queryFn: () => api.get<{ subscribed: boolean }>("/push/status"),
    enabled: isPushSupported(),
  });
}

export function useSubscribePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Permissão de notificação negada.");
      }

      const { publicKey } = await api.get<{ publicKey: string | null }>("/push/vapid-public-key");
      if (!publicKey) {
        throw new Error("Servidor ainda não configurou as chaves de notificação (VAPID).");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      await api.post("/push/subscribe", {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
    },
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
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push", "status"] }),
  });
}

export function useSendTestPush() {
  return useMutation({ mutationFn: () => api.post("/push/test") });
}
