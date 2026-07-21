import { create } from "zustand";
import { getToken, setToken } from "@/lib/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True for one render cycle right after an interactive login (password or Face ID) — lets the
   *  app-lock gate skip re-prompting for Face ID the instant someone just proved who they are,
   *  while still locking on a cold start where isAuthenticated came from a stored token instead. */
  justAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  consumeJustAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: Boolean(getToken()),
  justAuthenticated: false,
  login: (token, user) => {
    setToken(token);
    set({ user, isAuthenticated: true, justAuthenticated: true });
  },
  logout: () => {
    setToken(null);
    set({ user: null, isAuthenticated: false, justAuthenticated: false });
  },
  consumeJustAuthenticated: () => {
    const value = get().justAuthenticated;
    if (value) set({ justAuthenticated: false });
    return value;
  },
}));
