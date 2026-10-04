"use client";

import { useEffect, useRef } from "react";
import { initialState, loadState, saveState } from "@/lib/utils/storage";
import { decodeShareHash, withoutShareHash } from "@/lib/utils/share";
import { autoLayout } from "@/lib/layout";
import { useWorkflowStore } from "@/store/workflowStore";
import { useRunStore } from "@/store/runStore";
import { useUiStore } from "@/store/uiStore";
import { pushToast } from "@/store/toastStore";
import { adoptThemeIfUnset } from "@/components/layout/theme-provider";
import { WORKFLOW_SCHEMA_VERSION, createWorkflow } from "@/types/workflow";
import type { FlowEdge, FlowNode } from "@/types";

const SAVE_DEBOUNCE_MS = 600;
/** Autosave is silent except for one confirmation per this window. */
const SAVE_TOAST_COOLDOWN_MS = 15_000;
let lastSaveToastAt = 0;

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
      // Consume the link. Leaving the hash in the URL would make every reload
      // re-adopt it and shadow whatever this visitor has saved locally.
      window.history.replaceState(null, "", withoutShareHash(window.location.href));

      useUiStore.setState({ hydration: "ready" });
      return;
    }

    const loaded = loadState();
    if (loaded.ok) {
      store.hydrate(loaded.state);
      // Honour a theme that arrived with the saved file, unless the user has
      // already picked one in this browser.
      adoptThemeIfUnset(loaded.state.settings.theme);
      useUiStore.setState({
        speed: loaded.state.settings.speed,
        showMinimap: loaded.state.settings.showMinimap,
        favouriteNodes: loaded.state.settings.favouriteNodes ?? [],
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
  const favouriteNodes = useUiStore((state) => state.favouriteNodes);

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
          favouriteNodes: useUiStore.getState().favouriteNodes,
        },
      });

      if (!result.ok) {
        console.warn("FlowForge: autosave failed.", result.error);
        pushToast("error", "Autosave failed — export your workflow to keep it");
        return;
      }

      // Autosave fires ~600ms after every edit pause, so an unthrottled toast
      // would be constant noise. Confirming at most once a quarter of a minute
      // still tells you your work is safe without nagging on every keystroke.
      const now = Date.now();
      if (now - lastSaveToastAt > SAVE_TOAST_COOLDOWN_MS) {
        lastSaveToastAt = now;
        pushToast("ok", "Saved to this browser");
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflows, workflowName, viewport, runHistory, favouriteNodes, hydration]);
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
