import type { Edge } from "@xyflow/react";

/** Condition nodes expose two output handles; every other node uses "out". */
export type SourceHandleId = "out" | "true" | "false";
export type TargetHandleId = "in";

export const SOURCE_HANDLE_OUT: SourceHandleId = "out";
export const SOURCE_HANDLE_TRUE: SourceHandleId = "true";
export const SOURCE_HANDLE_FALSE: SourceHandleId = "false";
export const TARGET_HANDLE_IN: TargetHandleId = "in";

export type FlowEdgeData = {
  /** Set while a payload is in flight; drives the travelling-particle animation. */
  active: boolean;
  /** Renders "true" / "false" on condition branches. */
  label?: string;
  /** True when the branch was not taken in the most recent run. */
  dimmed?: boolean;
};

export type FlowEdge = Edge<FlowEdgeData, "animated-flow">;

export function createFlowEdge(
  id: string,
  source: string,
  target: string,
  options: { sourceHandle?: SourceHandleId; label?: string } = {},
): FlowEdge {
  return {
    id,
    source,
    target,
    sourceHandle: options.sourceHandle ?? SOURCE_HANDLE_OUT,
    targetHandle: TARGET_HANDLE_IN,
    type: "animated-flow",
    data: { active: false, label: options.label },
  };
}

/** Handle ids a node type accepts on its input side. */
export function isSourceHandle(value: string | null | undefined): value is SourceHandleId {
  return value === "out" || value === "true" || value === "false";
}
