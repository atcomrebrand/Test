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
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: Boolean(getToken()),
  login: (token, user) => {
    setToken(token);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    setToken(null);
    set({ user: null, isAuthenticated: false });
  },
}));
