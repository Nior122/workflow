/**
 * Pure graph analysis: cycle detection, topological waves, reachability.
 *
 * The executor runs a *wave* at a time — every node in a wave has all of its
 * dependencies in earlier waves, and nodes within a wave run concurrently. That is
 * what lets branches animate in parallel while merges still wait correctly.
 */

import { hasInput } from "@/types/nodes";
import type { FlowEdge, FlowNode } from "@/types";

export type EdgeRef = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceHandle: string | null;
};

export type GraphAnalysis = {
  nodeIds: string[];
  /** Edges pointing at a node that is not on the canvas. */
  danglingEdgeIds: string[];
  incoming: Map<string, EdgeRef[]>;
  outgoing: Map<string, EdgeRef[]>;
  /** Nodes whose type takes no input. */
  triggerIds: string[];
  /** Topological generations. Empty when a cycle exists. */
  waves: string[][];
  hasCycle: boolean;
  /** Nodes left over after Kahn's algorithm — i.e. on or downstream of a cycle. */
  cycleNodeIds: string[];
  /** Nodes reachable by following edges forward from any trigger. */
  reachableFromTriggers: string[];
};

function emptyIncoming(nodeIds: string[]): Map<string, EdgeRef[]> {
  return new Map(nodeIds.map((id) => [id, []]));
}

export function analyzeGraph(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): GraphAnalysis {
  const nodeIds = nodes.map((node) => node.id);
  const nodeSet = new Set(nodeIds);

  const incoming = emptyIncoming(nodeIds);
  const outgoing = emptyIncoming(nodeIds);
  const danglingEdgeIds: string[] = [];

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
      danglingEdgeIds.push(edge.id);
      continue;
    }
    const ref: EdgeRef = {
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
    };
    incoming.get(edge.target)!.push(ref);
    outgoing.get(edge.source)!.push(ref);
  }

  const triggerIds = nodes
    .filter((node) => !hasInput(node.type))
    .map((node) => node.id);

  // Kahn's algorithm, one wave per generation.
  const inDegree = new Map(
    nodeIds.map((id) => [id, incoming.get(id)!.length]),
  );
  let frontier = nodeIds.filter((id) => inDegree.get(id) === 0);
  const waves: string[][] = [];
  let scheduled = 0;

  while (frontier.length > 0) {
    // Deterministic order so runs and tests are reproducible.
    frontier = [...frontier].sort();
    waves.push(frontier);
    scheduled += frontier.length;

    const next: string[] = [];
    for (const id of frontier) {
      for (const ref of outgoing.get(id)!) {
        const remaining = inDegree.get(ref.targetId)! - 1;
        inDegree.set(ref.targetId, remaining);
        if (remaining === 0) next.push(ref.targetId);
      }
    }
    frontier = next;
  }

  const hasCycle = scheduled < nodeIds.length;
  const cycleNodeIds = hasCycle
    ? nodeIds.filter((id) => inDegree.get(id)! > 0)
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

  return {
    nodeIds,
    danglingEdgeIds,
    incoming,
    outgoing,
    triggerIds,
    waves: hasCycle ? [] : waves,
    hasCycle,
    cycleNodeIds,
    reachableFromTriggers: [...reachable],
  };
}

/** True when a node has at least one incoming edge from a node that is not a trigger. */
export function isMergePoint(analysis: GraphAnalysis, nodeId: string): boolean {
  return (analysis.incoming.get(nodeId)?.length ?? 0) > 1;
}
