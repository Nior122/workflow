/**
 * Pure graph analysis: cycle detection, topological waves, reachability, and
 * AI Agent sub-node attachment resolution.
 */

import { hasInput } from "@/types/nodes";
import type { FlowEdge, FlowNode } from "@/types";

export type EdgeRef = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceHandle: string | null;
  targetHandle?: string | null;
};

export type GraphAnalysis = {
  nodeIds: string[];
  /** Edges pointing at a node that is not on the canvas. */
  danglingEdgeIds: string[];
  incoming: Map<string, EdgeRef[]>;
  outgoing: Map<string, EdgeRef[]>;
  /** AI Agent sub-node edges (`ai_model`, `ai_memory`, `ai_tool`) keyed by target agent nodeId. */
  subNodeEdges: Map<string, EdgeRef[]>;
  /** Nodes whose type is a workflow trigger (`trigger.*`). */
  triggerIds: string[];
  /** Topological generations for main-flow nodes. Empty when a cycle exists. */
  waves: string[][];
  hasCycle: boolean;
  /** Nodes left over after Kahn's algorithm — i.e. on or downstream of a cycle. */
  cycleNodeIds: string[];
  /** Nodes reachable by following edges forward from any trigger (plus attached sub-nodes & sticky notes). */
  reachableFromTriggers: string[];
};

function emptyEdgeMap(nodeIds: string[]): Map<string, EdgeRef[]> {
  return new Map(nodeIds.map((id) => [id, []]));
}

export function isAiSubNodeType(type: string): boolean {
  return (
    type.startsWith("aiModel.") ||
    type.startsWith("aiMemory.") ||
    type.startsWith("aiTool.")
  );
}

export function isStickyNoteType(type: string): boolean {
  return type === "logic.stickyNote";
}

function isSubNodeHandle(handle: string | null | undefined): boolean {
  return handle === "ai_model" || handle === "ai_memory" || handle === "ai_tool";
}

export function analyzeGraph(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): GraphAnalysis {
  const nodeIds = nodes.map((node) => node.id);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeSet = new Set(nodeIds);

  const incoming = emptyEdgeMap(nodeIds);
  const outgoing = emptyEdgeMap(nodeIds);
  const subNodeEdges = emptyEdgeMap(nodeIds);
  const danglingEdgeIds: string[] = [];

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
      danglingEdgeIds.push(edge.id);
      continue;
    }
    const sourceNode = nodeById.get(edge.source);
    const ref: EdgeRef = {
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    };

    if (
      (sourceNode && isAiSubNodeType(sourceNode.type)) ||
      isSubNodeHandle(edge.sourceHandle) ||
      isSubNodeHandle(edge.targetHandle)
    ) {
      subNodeEdges.get(edge.target)!.push(ref);
      continue;
    }

    incoming.get(edge.target)!.push(ref);
    outgoing.get(edge.source)!.push(ref);
  }

  // Only true trigger nodes (`trigger.*`) act as workflow entry points.
  const triggerIds = nodes
    .filter(
      (node) =>
        !hasInput(node.type) &&
        !isAiSubNodeType(node.type) &&
        !isStickyNoteType(node.type),
    )
    .map((node) => node.id);

  // Main-flow nodes participate in topological wave scheduling.
  const mainFlowNodeIds = nodes
    .filter((node) => !isAiSubNodeType(node.type) && !isStickyNoteType(node.type))
    .map((node) => node.id);

  const inDegree = new Map(
    mainFlowNodeIds.map((id) => [id, incoming.get(id)!.length]),
  );
  let frontier = mainFlowNodeIds.filter((id) => inDegree.get(id) === 0);
  const waves: string[][] = [];
  let scheduled = 0;

  while (frontier.length > 0) {
    frontier = [...frontier].sort();
    waves.push(frontier);
    scheduled += frontier.length;

    const next: string[] = [];
    for (const id of frontier) {
      for (const ref of outgoing.get(id) ?? []) {
        if (!inDegree.has(ref.targetId)) continue;
        const remaining = inDegree.get(ref.targetId)! - 1;
        inDegree.set(ref.targetId, remaining);
        if (remaining === 0) next.push(ref.targetId);
      }
    }
    frontier = next;
  }

  const hasCycle = scheduled < mainFlowNodeIds.length;
  const cycleNodeIds = hasCycle
    ? mainFlowNodeIds.filter((id) => (inDegree.get(id) ?? 0) > 0)
    : [];

  // Forward reachability from triggers.
  const reachable = new Set<string>();
  const queue = [...triggerIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const ref of outgoing.get(id) ?? []) {
      if (!reachable.has(ref.targetId)) queue.push(ref.targetId);
    }
  }

  // Sub-nodes attached to reachable AI Agents and Sticky Notes are also considered reachable.
  for (const node of nodes) {
    if (isStickyNoteType(node.type)) {
      reachable.add(node.id);
    }
    if (reachable.has(node.id)) {
      for (const subRef of subNodeEdges.get(node.id) ?? []) {
        reachable.add(subRef.sourceId);
      }
    }
  }

  return {
    nodeIds,
    danglingEdgeIds,
    incoming,
    outgoing,
    subNodeEdges,
    triggerIds,
    waves: hasCycle ? [] : waves,
    hasCycle,
    cycleNodeIds,
    reachableFromTriggers: [...reachable],
  };
}

/** True when a node has more than one incoming main-flow edge. */
export function isMergePoint(analysis: GraphAnalysis, nodeId: string): boolean {
  return (analysis.incoming.get(nodeId)?.length ?? 0) > 1;
}
