import { create } from "zustand";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

function applyDom(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem("cc_theme") as ThemeMode | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const initial = getInitialMode();
applyDom(initial);

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initial,
  toggle: () => {
    const next = get().mode === "dark" ? "light" : "dark";
    localStorage.setItem("cc_theme", next);
    applyDom(next);
    set({ mode: next });
  },
  setMode: (mode) => {
    localStorage.setItem("cc_theme", mode);
    applyDom(mode);
    set({ mode });
  },
}));
