import { create } from "zustand";
import type { ExecutionSpeed } from "@/types/run";
import { DEFAULT_SPEED } from "@/config/constants";

/**
 * Docked panels the shell can collapse.
 *
 * The run console is deliberately absent: its open/collapsed state is local to
 * `BottomPanel` because it also owns the drag-resize height, and no other
 * component ever needed to read it. A `consoleOpen` flag used to live here and
 * nothing consumed it.
 */
export type PanelId = "palette" | "inspector";

export type HydrationState = "loading" | "ready" | "unavailable";

type UiState = {
  paletteOpen: boolean;
  inspectorOpen: boolean;
  /** Template gallery dialog. Shared so the canvas empty state can open it. */
  templatesOpen: boolean;
  showMinimap: boolean;
  speed: ExecutionSpeed;
  /** True while a run is in flight; the Run button and palette lock during it. */
  isRunning: boolean;
  /** Progress of the localStorage / share-link hydration pass. */
  hydration: HydrationState;

  togglePanel: (panel: PanelId) => void;
  setPanel: (panel: PanelId, open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setSpeed: (speed: ExecutionSpeed) => void;
  setIsRunning: (running: boolean) => void;
  setHydration: (hydration: HydrationState) => void;
};

/**
 * UI chrome state only. Node/edge data lives in `workflowStore` and run data in
 * `runStore`, so toggling a panel never re-renders the canvas graph.
 */
export const useUiStore = create<UiState>((set) => ({
  paletteOpen: true,
  inspectorOpen: true,
  templatesOpen: false,
  showMinimap: true,
  speed: DEFAULT_SPEED,
  isRunning: false,
  hydration: "loading",

  togglePanel: (panel) =>
    set((state) => {
      switch (panel) {
        case "palette":
          return { paletteOpen: !state.paletteOpen };
        case "inspector":
          return { inspectorOpen: !state.inspectorOpen };
      }
    }),

  setPanel: (panel, open) =>
    set(() => {
      switch (panel) {
        case "palette":
          return { paletteOpen: open };
        case "inspector":
          return { inspectorOpen: open };
      }
    }),

  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
  setShowMinimap: (showMinimap) => set({ showMinimap }),
  setSpeed: (speed) => set({ speed }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setHydration: (hydration) => set({ hydration }),
}));

export function useIsRunning(): boolean {
  return useUiStore((state) => state.isRunning);
}

export function useSpeed(): ExecutionSpeed {
  return useUiStore((state) => state.speed);
}
