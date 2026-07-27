import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ScanFace, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/features/useSettings";
import { useLoginWithFaceId, useWebAuthnCredentials } from "@/features/useWebAuthn";
import { useAuthStore } from "@/store/auth";
import { useAppLockStore } from "@/store/appLock";
import { AssistantWidget } from "./AssistantWidget";

/**
 * An app-lock layer on top of the JWT session: even with a valid token, re-demands Face ID/Touch
 * ID every time the app is opened cold or comes back from the background — the JWT alone never
 * unlocks it. Fails open (never locks) if the setting is on but no passkey is actually registered,
 * since locking someone out of their own finance app with no way back in would be worse than the
 * feature itself.
 */
export function AppLockGate() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: credentials, isLoading: credentialsLoading } = useWebAuthnCredentials();
  const locked = useAppLockStore((s) => s.locked);
  const lock = useAppLockStore((s) => s.lock);
  const unlock = useAppLockStore((s) => s.unlock);
  const loginWithFaceId = useLoginWithFaceId();
  const logout = useAuthStore((s) => s.logout);

  const lockEnabled = Boolean(settings?.biometricLockEnabled) && (credentials?.length ?? 0) > 0;
  const evaluatedInitialLock = useRef(false);
  const wasHidden = useRef(false);

  useEffect(() => {
    if (settingsLoading || credentialsLoading || evaluatedInitialLock.current) return;
    evaluatedInitialLock.current = true;
    if (!lockEnabled) return;
    // Skip the redundant prompt the instant someone just proved who they are (password or Face
    // ID login) — only cold starts/returns from background should ask again.
    if (useAuthStore.getState().consumeJustAuthenticated()) return;
    lock();
  }, [settingsLoading, credentialsLoading, lockEnabled, lock]);

  useEffect(() => {
    if (!lockEnabled) return;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
      } else if (document.visibilityState === "visible" && wasHidden.current) {
        wasHidden.current = false;
        lock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [lockEnabled, lock]);

  function onUnlock() {
    loginWithFaceId.mutate(undefined, {
      onSuccess: () => unlock(),
      onError: () => toast.error("Não foi possível verificar o Face ID/Touch ID."),
    });
  }

  if (locked && lockEnabled) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[rgb(var(--bg))] px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-elevated">
            <ScanFace className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">App bloqueado</h1>
            <p className="mt-1 text-sm text-muted">Use Face ID/Touch ID para continuar.</p>
          </div>
          <Button className="w-full" loading={loginWithFaceId.isPending} onClick={onUnlock}>
            <ScanFace className="h-4 w-4" /> Desbloquear com Face ID/Touch ID
          </Button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-muted hover:underline"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair e entrar com senha
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <AssistantWidget />
    </>
  );
}
