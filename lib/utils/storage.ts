/**
 * localStorage persistence.
 *
 * Every read and write is wrapped: private browsing, a full quota and disabled
 * storage all throw, and none of them should take the app down.
 */

import { STORAGE_KEY } from "@/config/constants";
import {
  DEFAULT_SETTINGS,
  WORKFLOW_SCHEMA_VERSION,
  createWorkflow,
  isPersistedState,
  type PersistedState,
} from "@/types/workflow";

export type LoadResult =
  | { ok: true; state: PersistedState }
  | { ok: false; reason: "empty" | "corrupt" | "unavailable"; detail?: string };

export function loadState(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      detail: error instanceof Error ? error.message : "localStorage is blocked",
    };
  }

  if (!raw) return { ok: false, reason: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", detail: "Saved data is not valid JSON" };
  }

  if (!isPersistedState(parsed)) {
    return { ok: false, reason: "corrupt", detail: "Saved data has the wrong shape" };
  }

  return { ok: true, state: migrate(parsed) };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export function saveState(state: PersistedState): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    // Almost always QuotaExceededError from verbose run history.
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "QuotaExceededError"
          ? "Browser storage is full. Clear some run history and try again."
          : "Could not save to browser storage.",
    };
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do if removal fails; the next save overwrites anyway.
  }
}

/**
 * Forward-migrate older saved shapes.
 *
 * Only v1 exists today, so this fills in anything a partial write may have lost
 * rather than transforming between versions.
 */
function migrate(state: PersistedState): PersistedState {
  if (state.schemaVersion === WORKFLOW_SCHEMA_VERSION) {
    return {
      ...state,
      settings: { ...DEFAULT_SETTINGS, ...state.settings },
      runHistory: state.runHistory ?? [],
    };
  }

  // Unknown or missing version: keep the workflows, reset everything else.
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    activeWorkflowId: state.activeWorkflowId || "default",
    workflows: state.workflows?.length
      ? state.workflows
      : [createWorkflow("default", "Untitled workflow")],
    runHistory: [],
    settings: DEFAULT_SETTINGS,
  };
}

/** A fresh state for first-time visitors. */
export function initialState(): PersistedState {
  const workflow = createWorkflow("default", "Untitled workflow");
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    activeWorkflowId: workflow.id,
    workflows: [workflow],
    runHistory: [],
    settings: DEFAULT_SETTINGS,
  };
}
