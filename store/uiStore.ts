import { create } from "zustand";
import type { ExecutionSpeed } from "@/types/run";
import { DEFAULT_SPEED } from "@/config/constants";

export type PanelId = "palette" | "inspector" | "console";

export type HydrationState = "loading" | "ready" | "unavailable";

type UiState = {
  paletteOpen: boolean;
  inspectorOpen: boolean;
  consoleOpen: boolean;
  showMinimap: boolean;
  speed: ExecutionSpeed;
  /** True while a run is in flight; the Run button and palette lock during it. */
  isRunning: boolean;
  /** Progress of the localStorage / share-link hydration pass. */
  hydration: HydrationState;

  togglePanel: (panel: PanelId) => void;
  setPanel: (panel: PanelId, open: boolean) => void;
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
  consoleOpen: true,
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
        case "console":
          return { consoleOpen: !state.consoleOpen };
      }
    }),

  setPanel: (panel, open) =>
    set(() => {
      switch (panel) {
        case "palette":
          return { paletteOpen: open };
        case "inspector":
          return { inspectorOpen: open };
        case "console":
          return { consoleOpen: open };
      }
    }),

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
