import type { ExecutionSpeed, RunResult } from "./run";
import type { FlowEdge } from "./edges";
import type { FlowNode, NodeType } from "./nodes";
import { DEFAULT_SPEED, DEFAULT_VIEWPORT } from "@/config/constants";

export const WORKFLOW_SCHEMA_VERSION = 1;

export type Viewport = { x: number; y: number; zoom: number };

export type Workflow = {
  id: string;
  name: string;
  schemaVersion: number;
  /** epoch ms */
  createdAt: number;
  updatedAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  /** Set when the workflow was created from a gallery template. */
  templateId?: string;
};

export type Theme = "dark" | "light";

export type AppSettings = {
  theme: Theme;
  speed: ExecutionSpeed;
  snapToGrid: boolean;
  showMinimap: boolean;
  /** Node types pinned to the top of the palette. */
  favouriteNodes?: NodeType[];
};

/** The single object written to localStorage under STORAGE_KEY. */
export type PersistedState = {
  schemaVersion: number;
  activeWorkflowId: string;
  workflows: Workflow[];
  /** Capped at RUN_HISTORY_LIMIT, newest first. */
  runHistory: RunResult[];
  settings: AppSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  speed: DEFAULT_SPEED,
  snapToGrid: false,
  showMinimap: true,
  favouriteNodes: [],
};

export function createWorkflow(
  id: string,
  name: string,
  seed: Partial<Pick<Workflow, "nodes" | "edges" | "viewport" | "templateId">> = {},
): Workflow {
  const now = Date.now();
  return {
    id,
    name,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    nodes: seed.nodes ?? [],
    edges: seed.edges ?? [],
    viewport: seed.viewport ?? { ...DEFAULT_VIEWPORT },
    templateId: seed.templateId,
  };
}

/**
 * Cheap structural validation for imported files and localStorage payloads.
 * Deliberately shallow: it rejects obviously-wrong shapes, it is not a schema validator.
 */
export function isWorkflow(value: unknown): value is Workflow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Workflow>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
}

export function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedState>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.activeWorkflowId === "string" &&
    Array.isArray(candidate.workflows)
  );
}
