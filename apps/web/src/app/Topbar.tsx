import { useState } from "react";
import { Bell, HelpCircle, Moon, Search, Sun, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeStore } from "@/store/theme";
import { useUiStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@/features/useNotifications";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Topbar() {
  const { mode, toggle } = useThemeStore();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const openHelp = useUiStore((s) => s.openHelp);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[rgb(var(--border))] surface/80 px-4 backdrop-blur md:px-6">
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex h-10 min-w-0 flex-1 max-w-md items-center gap-2 rounded-xl surface-2 px-3 text-sm text-muted transition-colors hover:brightness-95 dark:hover:brightness-110"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate whitespace-nowrap sm:hidden">Buscar...</span>
        <span className="hidden truncate whitespace-nowrap sm:inline">Buscar compras, cartões, categorias...</span>
        <kbd className="ml-auto hidden shrink-0 rounded surface px-1.5 py-0.5 font-mono text-xs sm:inline-block">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:surface-2"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-[rgb(var(--border))] surface shadow-elevated"
                >
                  <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
                    <p className="text-sm font-semibold">Notificações</p>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        className="text-xs font-medium text-accent-500 hover:underline"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifications || notifications.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted">Nenhuma notificação por aqui.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markRead.mutate(n.id)}
                          className={cn(
                            "block w-full border-b border-[rgb(var(--border))] px-4 py-3 text-left text-sm transition-colors last:border-0 hover:surface-2",
                            !n.read && "bg-accent-500/5",
                          )}
                        >
                          <p className="font-medium">{n.title}</p>
                          <p className="mt-0.5 text-xs text-muted">{n.message}</p>
                          <p className="mt-1 text-[10px] text-muted">{formatDate(n.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:surface-2"
          aria-label="Alternar tema"
        >
          {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          onClick={() => openHelp()}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:surface-2"
          aria-label="Central de ajuda"
          title="Central de ajuda (?)"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <div className="ml-1 hidden items-center gap-2 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:surface-2"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
