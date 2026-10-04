import type { Edge } from "@xyflow/react";
import type { PortKind } from "./registry";

/**
 * Source handle IDs across main-flow, multi-branch (`action.condition`,
 * `logic.switch`, `logic.loopOverItems`), error branches, and AI Agent sub-nodes.
 */
export type SourceHandleId =
  | "out"
  | "true"
  | "false"
  | "case_0"
  | "case_1"
  | "case_2"
  | "fallback"
  | "loop"
  | "done"
  | "error"
  | "ai_model"
  | "ai_memory"
  | "ai_tool"
  | (string & {});

export type TargetHandleId =
  | "in"
  | "ai_model"
  | "ai_memory"
  | "ai_tool"
  | (string & {});

export const SOURCE_HANDLE_OUT: SourceHandleId = "out";
export const SOURCE_HANDLE_TRUE: SourceHandleId = "true";
export const SOURCE_HANDLE_FALSE: SourceHandleId = "false";
export const TARGET_HANDLE_IN: TargetHandleId = "in";

export type FlowEdgeData = {
  /** Set while a payload is in flight; drives the travelling-particle animation. */
  active: boolean;
  /** Renders "true" / "false" / "case_0" on condition and switch branches. */
  label?: string;
  /** True when the branch was not taken in the most recent run. */
  dimmed?: boolean;
  /** Number of items that flowed across this edge in the last run (e.g. `3 items`). */
  itemCount?: number;
  /** Port kind (`main | ai_model | ai_memory | ai_tool`) for sub-node edge styling. */
  portKind?: PortKind;
};

export type FlowEdge = Edge<FlowEdgeData, "animated-flow">;

/** Map a source handle id onto a port kind (`main` for every non-sub-node handle). */
export function portKindFromSourceHandle(sourceHandle: string): PortKind {
  if (
    sourceHandle === "ai_model" ||
    sourceHandle === "ai_memory" ||
    sourceHandle === "ai_tool"
  ) {
    return sourceHandle;
  }
  return "main";
}

export function createFlowEdge(
  id: string,
  source: string,
  target: string,
  options: {
    sourceHandle?: SourceHandleId;
    targetHandle?: TargetHandleId;
    label?: string;
    portKind?: PortKind;
  } = {},
): FlowEdge {
  const sourceHandle = options.sourceHandle ?? SOURCE_HANDLE_OUT;
  const inferredTarget =
    options.targetHandle ??
    (sourceHandle === "ai_model" ||
    sourceHandle === "ai_memory" ||
    sourceHandle === "ai_tool"
      ? sourceHandle
      : TARGET_HANDLE_IN);
  const inferredPortKind: PortKind =
    options.portKind ?? portKindFromSourceHandle(sourceHandle);

  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle: inferredTarget,
    type: "animated-flow",
    data: {
      active: false,
      label: options.label,
      portKind: inferredPortKind,
    },
  };
}

const VALID_SOURCE_HANDLES = new Set<string>([
  "out",
  "true",
  "false",
  "case_0",
  "case_1",
  "case_2",
  "fallback",
  "loop",
  "done",
  "error",
  "ai_model",
  "ai_memory",
  "ai_tool",
]);

const VALID_TARGET_HANDLES = new Set<string>([
  "in",
  "ai_model",
  "ai_memory",
  "ai_tool",
]);

/** Handle ids a node type accepts on its input side. */
export function isTargetHandle(value: string | null | undefined): value is TargetHandleId {
  return typeof value === "string" && VALID_TARGET_HANDLES.has(value);
}

/** Handle ids a node type accepts on its output side. */
export function isSourceHandle(value: string | null | undefined): value is SourceHandleId {
  return typeof value === "string" && VALID_SOURCE_HANDLES.has(value);
}
