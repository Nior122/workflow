/**
 * Pre-run validation.
 *
 * Runs before the executor so problems are attached to the specific nodes that
 * caused them, rather than surfacing as a mid-run failure. Pure module.
 */

import { analyzeGraph } from "./graph";
import { requireNodeDef } from "./registry";
import type { FlowEdge, FlowNode } from "@/types";
import type { ValidationIssue, ValidationResult } from "@/types/validation";

export function validateWorkflow(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (nodes.length === 0) {
    return {
      valid: false,
      issues: [
        {
          code: "empty-workflow",
          level: "error",
          message: "The canvas is empty. Add a trigger to get started.",
        },
      ],
      waves: [],
      reachable: [],
    };
  }

  const graph = analyzeGraph(nodes, edges);

  // Edges pointing at nodes that no longer exist.
  for (const edgeId of graph.danglingEdgeIds) {
    issues.push({
      code: "dangling-edge",
      level: "error",
      edgeId,
      message: "A connection references a node that is not on the canvas.",
    });
  }

  // Cycles.
  if (graph.hasCycle) {
    for (const nodeId of graph.cycleNodeIds) {
      issues.push({
        code: "cycle-detected",
        level: "error",
        nodeId,
        message: "This node is part of a loop. Flows must be acyclic.",
      });
    }
  }

  // Trigger presence.
  if (graph.triggerIds.length === 0) {
    issues.push({
      code: "missing-trigger",
      level: "error",
      message: "Every flow needs a trigger node to start it.",
    });
  } else if (graph.triggerIds.length > 1) {
    issues.push({
      code: "multiple-triggers",
      level: "warning",
      message: `${graph.triggerIds.length} triggers found — all of them will fire.`,
    });
  }

  // Reachability, only meaningful when the graph is acyclic.
  const reachableSet = new Set(graph.reachableFromTriggers);
  if (!graph.hasCycle && graph.triggerIds.length > 0) {
    for (const node of nodes) {
      if (!reachableSet.has(node.id)) {
        issues.push({
          code: "unreachable-node",
          level: "error",
          nodeId: node.id,
          message: "Nothing connects into this node from a trigger.",
        });
      }
    }
  }

  // Per-node config validation.
  for (const node of nodes) {
    const def = requireNodeDef(node.type);
    for (const issue of def.validateConfig(node.data.config)) {
      issues.push({ ...issue, nodeId: node.id });
    }
  }

  return {
    valid: !issues.some((issue) => issue.level === "error"),
    issues,
    waves: graph.waves,
    reachable: [...reachableSet],
  };
}

/** Issues grouped by node id, for writing onto node data. */
export function issuesByNode(issues: readonly ValidationIssue[]): Map<string, ValidationIssue[]> {
  const grouped = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    const existing = grouped.get(issue.nodeId);
    if (existing) existing.push(issue);
    else grouped.set(issue.nodeId, [issue]);
  }
  return grouped;
}
