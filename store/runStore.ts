import { create } from "zustand";
import { RUN_HISTORY_LIMIT } from "@/config/constants";
import type {
  EngineEvent,
  NodeRunStatus,
  RunResult,
  RunStatus,
  StepLog,
} from "@/types/run";

export type ActiveEdge = {
  /** Absolute time the payload started travelling, from the engine's clock. */
  startedAt: number;
  durationMs: number;
  fromNodeId: string;
  toNodeId: string;
};

type RunState = {
  status: RunStatus;
  currentRunId: string | null;
  /** Live per-node status, drives the node visuals. */
  nodeStatuses: Record<string, NodeRunStatus>;
  /** Edges currently carrying a payload, drives the particle animation. */
  activeEdges: Record<string, ActiveEdge>;
  /** Steps of the run in progress. */
  steps: StepLog[];
  /** Last RUN_HISTORY_LIMIT runs, newest first. */
  history: RunResult[];
  /** Step ids expanded in the console. */
  expandedSteps: string[];
  /** Set when validation blocked the run, so the banner can explain why. */
  blockingMessage: string | null;

  beginRun: (runId: string, queuedNodeIds: string[]) => void;
  applyEvent: (event: EngineEvent) => void;
  completeRun: (result: RunResult) => void;
  resetStatuses: () => void;
  toggleStep: (stepId: string) => void;
  collapseAllSteps: () => void;
  setBlockingMessage: (message: string | null) => void;
  clearHistory: () => void;
};

export const useRunStore = create<RunState>((set) => ({
  status: "idle",
  currentRunId: null,
  nodeStatuses: {},
  activeEdges: {},
  steps: [],
  history: [],
  expandedSteps: [],
  blockingMessage: null,

  beginRun: (runId, queuedNodeIds) =>
    set(() => ({
      status: "running",
      currentRunId: runId,
      steps: [],
      expandedSteps: [],
      activeEdges: {},
      blockingMessage: null,
      nodeStatuses: Object.fromEntries(
        queuedNodeIds.map((id) => [id, "queued" as NodeRunStatus]),
      ),
    })),

  applyEvent: (event) =>
    set((state) => {
      switch (event.kind) {
        case "run:start":
          return { status: "running" };

        case "node:queued":
          return { nodeStatuses: { ...state.nodeStatuses, [event.nodeId]: "queued" } };

        case "node:running":
          return { nodeStatuses: { ...state.nodeStatuses, [event.nodeId]: "running" } };

        case "node:success":
          return {
            nodeStatuses: { ...state.nodeStatuses, [event.nodeId]: "success" },
          };

        case "node:error":
          return {
            nodeStatuses: { ...state.nodeStatuses, [event.nodeId]: "error" },
          };

        case "node:skipped":
          return {
            nodeStatuses: { ...state.nodeStatuses, [event.nodeId]: "skipped" },
          };

        case "edge:active":
          return {
            activeEdges: {
              ...state.activeEdges,
              [event.edgeId]: {
                startedAt: event.at,
                durationMs: event.durationMs,
                fromNodeId: event.fromNodeId,
                toNodeId: event.toNodeId,
              },
            },
          };

        case "run:end":
          return { status: event.status, activeEdges: {} };
      }
    }),

  completeRun: (result) =>
    set((state) => ({
      status: result.status,
      currentRunId: null,
      steps: result.steps,
      activeEdges: {},
      history: [result, ...state.history].slice(0, RUN_HISTORY_LIMIT),
      // Auto-expand the first failing step so the reason is immediately visible.
      expandedSteps: (() => {
        const failed = result.steps.find((entry) => entry.status === "error");
        return failed ? [failed.stepId] : [];
      })(),
    })),

  resetStatuses: () =>
    set(() => ({ status: "idle", nodeStatuses: {}, activeEdges: {}, steps: [], currentRunId: null })),

  toggleStep: (stepId) =>
    set((state) => ({
      expandedSteps: state.expandedSteps.includes(stepId)
        ? state.expandedSteps.filter((id) => id !== stepId)
        : [...state.expandedSteps, stepId],
    })),

  collapseAllSteps: () => set({ expandedSteps: [] }),

  setBlockingMessage: (blockingMessage) => set({ blockingMessage }),

  clearHistory: () => set({ history: [] }),
}));

/* ------------------------------------------------------------------ *
 * Narrow selectors
 * ------------------------------------------------------------------ */

export function useNodeStatus(nodeId: string): NodeRunStatus {
  return useRunStore((state) => state.nodeStatuses[nodeId] ?? "idle");
}

export function useIsEdgeActive(edgeId: string): boolean {
  return useRunStore((state) => edgeId in state.activeEdges);
}

export function useEdgeAnimation(edgeId: string): ActiveEdge | undefined {
  return useRunStore((state) => state.activeEdges[edgeId]);
}

export function useRunStatus(): RunStatus {
  return useRunStore((state) => state.status);
}

export function useRunSteps(): StepLog[] {
  return useRunStore((state) => state.steps);
}

export function useRunHistory(): RunResult[] {
  return useRunStore((state) => state.history);
}
