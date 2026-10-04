/**
 * Programmatic graph construction.
 *
 * Used by the template gallery and by the engine tests. Building a graph by hand
 * through `createFlowNode` alone means fighting its auto-incrementing ids, so this
 * wraps it with explicit, readable ids and partial config overrides.
 */

import { createFlowEdge, createFlowNode } from "@/lib/engine/registry";
import type { FlowEdge, FlowNode, FlowNodeOf, NodeConfigOf, NodeType } from "@/types";
import type { SourceHandleId, TargetHandleId } from "@/types/edges";
import type { PortKind } from "@/types/registry";

export type NodeOptions = {
  position?: { x: number; y: number };
  label?: string;
  simulateFailure?: boolean;
  latencyMs?: number;
};

/** Create a node with an explicit id and an optional partial config. */
export function buildNode<T extends NodeType>(
  id: string,
  type: T,
  config?: Partial<NodeConfigOf<T>>,
  options: NodeOptions = {},
): FlowNodeOf<T> {
  const node = createFlowNode(type, options.position ?? { x: 0, y: 0 }, id);

  return {
    ...node,
    id,
    data: {
      ...node.data,
      ...(options.label ? { label: options.label } : {}),
      ...(config ? { config: { ...node.data.config, ...config } } : {}),
      ...(options.simulateFailure !== undefined
        ? { simulateFailure: options.simulateFailure }
        : {}),
      ...(options.latencyMs !== undefined ? { latencyMs: options.latencyMs } : {}),
    },
  } as FlowNodeOf<T>;
}

/** Create an edge with a deterministic id derived from its endpoints. */
export function buildEdge(
  source: string,
  target: string,
  sourceHandle: SourceHandleId = "out",
): FlowEdge {
  return createFlowEdge(
    `e-${source}-${sourceHandle}-${target}`,
    source,
    target,
    {
      sourceHandle,
      label: sourceHandle === "out" ? undefined : sourceHandle,
    },
  );
}

/**
 * Wire an AI sub-node (`aiModel.*`, `aiMemory.*`, `aiTool.*`) into an AI Agent's
 * bottom port. Sub-node edges carry an explicit port kind so the canvas can colour
 * them and the executor can collect them into `ctx.subNodes`.
 */
export function buildSubNodeEdge(
  source: string,
  target: string,
  portKind: Exclude<PortKind, "main">,
): FlowEdge {
  const targetHandle: TargetHandleId = portKind;
  return createFlowEdge(`e-${source}-${portKind}-${target}`, source, target, {
    sourceHandle: portKind,
    targetHandle,
    portKind,
  });
}

export type BuiltGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/** Deep-copy a graph so instantiating a template twice yields independent nodes. */
export function cloneGraph(graph: BuiltGraph): BuiltGraph {
  return structuredClone(graph);
}
