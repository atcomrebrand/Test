import { create } from "zustand";

interface AppLockState {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

/** Whether the "peça Face ID toda vez que abrir o app" gate is currently blocking the app —
 *  separate from useAuthStore.isAuthenticated: the JWT session stays valid the whole time, this
 *  is an extra layer on top that gets re-armed on cold start and on returning from background. */
export const useAppLockStore = create<AppLockState>((set) => ({
  locked: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));
