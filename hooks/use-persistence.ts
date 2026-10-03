"use client";

import { useEffect, useRef } from "react";
import { initialState, loadState, saveState } from "@/lib/utils/storage";
import { decodeShareHash } from "@/lib/utils/share";
import { autoLayout } from "@/lib/layout";
import { useWorkflowStore } from "@/store/workflowStore";
import { useRunStore } from "@/store/runStore";
import { useUiStore } from "@/store/uiStore";
import { WORKFLOW_SCHEMA_VERSION, createWorkflow } from "@/types/workflow";
import type { FlowEdge, FlowNode } from "@/types";

const SAVE_DEBOUNCE_MS = 600;

/**
 * Hydrates the stores from localStorage (or a share link) and auto-saves changes.
 *
 * A share link wins over saved state, because opening someone's link is an
 * explicit intent — but it does not overwrite what is already saved.
 *
 * Hydration status lives in `uiStore` rather than React state so this hook can
 * write it from an effect without causing a cascading render.
 */
export function usePersistence(): void {
  const hydrated = useRef(false);
  const hydration = useUiStore((state) => state.hydration);

  // ---- hydrate once ----
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const store = useWorkflowStore.getState();

    const shared = readShareLink();
    if (shared) {
      const id = `shared-${Date.now().toString(36)}`;
      store.hydrate({
        workflows: [
          createWorkflow(id, shared.name, { nodes: shared.nodes, edges: shared.edges }),
        ],
        activeWorkflowId: id,
        runHistory: [],
      });
      useUiStore.setState({ hydration: "ready" });
      return;
    }

    const loaded = loadState();
    if (loaded.ok) {
      store.hydrate(loaded.state);
      useUiStore.setState({
        speed: loaded.state.settings.speed,
        showMinimap: loaded.state.settings.showMinimap,
        hydration: "ready",
      });
      useRunStore.setState({ history: loaded.state.runHistory });
      return;
    }

    if (loaded.reason === "corrupt") {
      // Tell the user rather than silently starting from nothing.
      console.warn("FlowForge: saved data was unreadable, starting fresh.", loaded.detail);
    }

    store.hydrate(initialState());
    useUiStore.setState({
      hydration: loaded.reason === "unavailable" ? "unavailable" : "ready",
    });
  }, []);

  // ---- auto-save ----
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const workflows = useWorkflowStore((state) => state.workflows);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const viewport = useWorkflowStore((state) => state.viewport);
  const runHistory = useWorkflowStore((state) => state.runHistory);

  useEffect(() => {
    if (hydration !== "ready") return;

    const timer = setTimeout(() => {
      const result = saveState({
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        activeWorkflowId: useWorkflowStore.getState().activeWorkflowId,
        workflows: useWorkflowStore.getState().snapshotWorkflows(),
        runHistory,
        settings: {
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          speed: useUiStore.getState().speed,
          snapToGrid: false,
          showMinimap: useUiStore.getState().showMinimap,
        },
      });

      if (!result.ok) console.warn("FlowForge: autosave failed.", result.error);
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflows, workflowName, viewport, runHistory, hydration]);
}

/** Parse a share link if the URL carries one, laying the graph out on arrival. */
function readShareLink(): { name: string; nodes: FlowNode[]; edges: FlowEdge[] } | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash.startsWith("#flow=")) return null;

  const decoded = decodeShareHash(hash);
  if (!decoded.ok) {
    console.warn("FlowForge: share link rejected.", decoded.error);
    return null;
  }

  // autoLayout moves nodes; edges follow their endpoints.
  const laidOut = autoLayout(decoded.value.nodes, decoded.value.edges);
  return { name: decoded.value.name, nodes: laidOut.nodes, edges: decoded.value.edges };
}
