import { create } from "zustand";

interface UiState {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  helpOpen: boolean;
  helpTopic: string | null;
  openHelp: (topic?: string) => void;
  setHelpOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  helpOpen: false,
  helpTopic: null,
  openHelp: (topic) => set({ helpOpen: true, helpTopic: topic ?? null }),
  setHelpOpen: (open) => set({ helpOpen: open }),
}));
