import { create } from "zustand";
import type { ExecutionSpeed } from "@/types/run";
import type { NodeType } from "@/types/nodes";
import { DEFAULT_SPEED } from "@/config/constants";

export type PanelId = "palette" | "inspector";

export type HydrationState = "loading" | "ready" | "unavailable";

export type QuickAddState = {
  open: boolean;
  /** Optional node ID whose output handle `+` was clicked (auto-connects on pick). */
  sourceNodeId?: string;
  /** Optional handle ID (`out`, `true`, `false`, `ai_model`, `ai_memory`, `ai_tool`). */
  sourceHandle?: string;
  /** Optional target handle filter when clicking an AI Agent bottom port (`ai_model` | `ai_memory` | `ai_tool`). */
  targetAgentId?: string;
  targetPortKind?: "ai_model" | "ai_memory" | "ai_tool";
  /** Canvas flow coordinates where the new node should be placed. */
  position?: { x: number; y: number };
  /** Increments on every open; the popup uses it as a remount key. */
  token: number;
};

export type ApprovalPromptState = {
  nodeId: string;
  nodeLabel: string;
  summary: string;
  details?: Record<string, unknown>;
  resolve: (approved: boolean) => void;
};

type UiState = {
  paletteOpen: boolean;
  inspectorOpen: boolean;
  /** Template gallery dialog. Shared so the canvas empty state can open it. */
  templatesOpen: boolean;
  showMinimap: boolean;
  speed: ExecutionSpeed;
  /** Node types pinned to the top of the palette. */
  favouriteNodes: NodeType[];
  /** Recently added node types (up to 8, newest first). */
  recentNodes: NodeType[];
  /** Quick-add node popup state (double-click canvas or click `+` on node port). */
  quickAdd: QuickAddState;
  /** Node ID currently inspected in the AI Agent Reasoning Trace drawer. */
  agentTraceNodeId: string | null;
  /** Active interactive `Wait for Human Approval` prompt during a run. */
  approvalPrompt: ApprovalPromptState | null;
  /** True while a run is in flight; the Run button and palette lock during it. */
  isRunning: boolean;
  /** Progress of the localStorage / share-link hydration pass. */
  hydration: HydrationState;

  togglePanel: (panel: PanelId) => void;
  setPanel: (panel: PanelId, open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setSpeed: (speed: ExecutionSpeed) => void;
  toggleFavouriteNode: (type: NodeType) => void;
  setFavouriteNodes: (types: NodeType[]) => void;
  recordRecentNode: (type: NodeType) => void;
  setRecentNodes: (types: NodeType[]) => void;
  openQuickAdd: (params?: Omit<QuickAddState, "open" | "token">) => void;
  closeQuickAdd: () => void;
  setAgentTraceNodeId: (nodeId: string | null) => void;
  setApprovalPrompt: (prompt: ApprovalPromptState | null) => void;
  setIsRunning: (running: boolean) => void;
  setHydration: (hydration: HydrationState) => void;
};

export const useUiStore = create<UiState>((set) => ({
  paletteOpen: true,
  inspectorOpen: true,
  templatesOpen: false,
  showMinimap: true,
  speed: DEFAULT_SPEED,
  favouriteNodes: [],
  recentNodes: [],
  quickAdd: { open: false, token: 0 },
  agentTraceNodeId: null,
  approvalPrompt: null,
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
  toggleFavouriteNode: (type) =>
    set((state) => ({
      favouriteNodes: state.favouriteNodes.includes(type)
        ? state.favouriteNodes.filter((entry) => entry !== type)
        : [...state.favouriteNodes, type],
    })),
  setFavouriteNodes: (favouriteNodes) =>
    set({ favouriteNodes: [...new Set(favouriteNodes)] }),
  recordRecentNode: (type) =>
    set((state) => ({
      recentNodes: [type, ...state.recentNodes.filter((t) => t !== type)].slice(0, 8),
    })),
  setRecentNodes: (recentNodes) =>
    set({ recentNodes: [...new Set(recentNodes)].slice(0, 8) }),
  openQuickAdd: (params = {}) =>
    set((state) => ({
      quickAdd: {
        open: true,
        // Monotonic per-open token: the popup keys its picker on it so each open
        // starts from an empty query without needing a reset effect.
        token: state.quickAdd.token + 1,
        ...params,
      },
    })),
  // Closing keeps the token (and the last open's params) so the popup can animate
  // out without the picker remounting mid-exit.
  closeQuickAdd: () => set((state) => ({ quickAdd: { ...state.quickAdd, open: false } })),
  setAgentTraceNodeId: (agentTraceNodeId) => set({ agentTraceNodeId }),
  setApprovalPrompt: (approvalPrompt) => set({ approvalPrompt }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setHydration: (hydration) => set({ hydration }),
}));

export function useIsRunning(): boolean {
  return useUiStore((state) => state.isRunning);
}

export function useSpeed(): ExecutionSpeed {
  return useUiStore((state) => state.speed);
}

export function useFavouriteNodes(): NodeType[] {
  return useUiStore((state) => state.favouriteNodes);
}

export function useRecentNodes(): NodeType[] {
  return useUiStore((state) => state.recentNodes);
}
