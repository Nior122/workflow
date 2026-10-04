/**
 * Pre-run validation & handle compatibility checks.
 *
 * Runs before the executor so problems are attached to the specific nodes that
 * caused them, rather than surfacing as a mid-run failure. Pure module.
 */

import { analyzeGraph, isAiSubNodeType, isStickyNoteType } from "./graph";
import { requireNodeDef } from "./registry";
import type { FlowEdge, FlowNode } from "@/types";
import { isSourceHandle, isTargetHandle } from "@/types/edges";
import type { ValidationIssue, ValidationResult } from "@/types/validation";

export function inferSubNodePortKind(
  nodeType: string,
): "ai_model" | "ai_memory" | "ai_tool" | "main" {
  if (nodeType.startsWith("aiModel.")) return "ai_model";
  if (nodeType.startsWith("aiMemory.")) return "ai_memory";
  if (nodeType.startsWith("aiTool.")) return "ai_tool";
  return "main";
}

/**
 * Validate whether connecting `sourceNode` -> `targetNode` on the given handles is
 * valid. Used both by `validateWorkflow` and interactively by the canvas `onConnect`
 * handler to display a clear toast on mismatched handle types.
 */
export function validateConnectionCompat(params: {
  sourceNode: FlowNode;
  targetNode: FlowNode;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  existingEdges?: readonly FlowEdge[];
}): { valid: boolean; reason?: string } {
  const { sourceNode, targetNode, sourceHandle, targetHandle, existingEdges = [] } = params;

  if (sourceNode.id === targetNode.id) {
    return { valid: false, reason: "A node cannot connect to itself." };
  }

  if (isStickyNoteType(sourceNode.type) || isStickyNoteType(targetNode.type)) {
    return { valid: false, reason: "Sticky Notes are annotations and cannot be wired." };
  }

  const sourceKind = inferSubNodePortKind(sourceNode.type);
  const effectiveSourceHandle =
    sourceHandle ?? (sourceKind !== "main" ? sourceKind : "out");
  const effectiveTargetHandle =
    targetHandle ?? (sourceKind !== "main" ? sourceKind : "in");

  // Sub-node source (`aiModel.*`, `aiMemory.*`, `aiTool.*`)
  if (sourceKind !== "main") {
    if (targetNode.type !== "action.aiAgent") {
      return {
        valid: false,
        reason: `${sourceNode.data.label} is an AI sub-node and can only connect to an AI Agent node.`,
      };
    }
    if (
      effectiveTargetHandle !== "in" &&
      effectiveTargetHandle !== sourceKind
    ) {
      const portLabel =
        sourceKind === "ai_model"
          ? "Model"
          : sourceKind === "ai_memory"
            ? "Memory"
            : "Tool";
      return {
        valid: false,
        reason: `${sourceNode.data.label} must connect to the AI Agent's ${portLabel} port (not "${effectiveTargetHandle}").`,
      };
    }

    if (sourceKind === "ai_model" || sourceKind === "ai_memory") {
      const alreadyConnected = existingEdges.some(
        (edge) =>
          edge.target === targetNode.id &&
          edge.source !== sourceNode.id &&
          (edge.targetHandle === sourceKind ||
            edge.sourceHandle === sourceKind),
      );
      if (alreadyConnected) {
        const label = sourceKind === "ai_model" ? "Chat Model" : "Memory";
        return {
          valid: false,
          reason: `An AI Agent can only have 1 connected ${label} sub-node.`,
        };
      }
    }

    return { valid: true };
  }

  // Main-flow source trying to plug into an AI sub-node or AI Agent bottom port
  if (isAiSubNodeType(targetNode.type)) {
    return {
      valid: false,
      reason: `${targetNode.data.label} is a sub-node and does not accept incoming workflow connections.`,
    };
  }

  if (
    effectiveTargetHandle === "ai_model" ||
    effectiveTargetHandle === "ai_memory" ||
    effectiveTargetHandle === "ai_tool"
  ) {
    return {
      valid: false,
      reason: `Only AI ${effectiveTargetHandle.replace("ai_", "")} sub-nodes can connect to the "${effectiveTargetHandle}" port.`,
    };
  }

  if (effectiveSourceHandle === "ai_model" || effectiveSourceHandle === "ai_memory" || effectiveSourceHandle === "ai_tool") {
    return {
      valid: false,
      reason: "Main workflow nodes cannot emit on AI sub-node handles.",
    };
  }

  // Handle ids that belong to no port on this node would produce an edge the
  // canvas can never draw, so they are refused outright.
  if (targetHandle != null && !isTargetHandle(targetHandle)) {
    return {
      valid: false,
      reason: `${targetNode.data.label} does not have a "${targetHandle}" input port.`,
    };
  }
  if (sourceHandle != null && !isSourceHandle(sourceHandle)) {
    return {
      valid: false,
      reason: `${sourceNode.data.label} does not have a "${sourceHandle}" output port.`,
    };
  }

  return { valid: true };
}

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
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Edges pointing at nodes that no longer exist.
  for (const edgeId of graph.danglingEdgeIds) {
    issues.push({
      code: "dangling-edge",
      level: "error",
      edgeId,
      message: "A connection references a node that is not on the canvas.",
    });
  }

  // Validate handle compatibility on every edge.
  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const compat = validateConnectionCompat({
      sourceNode,
      targetNode,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    });
    if (!compat.valid && compat.reason) {
      issues.push({
        code: "invalid-config",
        level: "error",
        edgeId: edge.id,
        nodeId: targetNode.id,
        message: compat.reason,
      });
    }
  }

  // Check max 1 model and max 1 memory per AI Agent.
  for (const [agentId, subRefs] of graph.subNodeEdges.entries()) {
    const models = subRefs.filter((r) => {
      const src = nodeById.get(r.sourceId);
      return src && inferSubNodePortKind(src.type) === "ai_model";
    });
    if (models.length > 1) {
      issues.push({
        code: "invalid-config",
        level: "error",
        nodeId: agentId,
        message: "Only 1 Chat Model sub-node can be connected to an AI Agent.",
      });
    }
    const memories = subRefs.filter((r) => {
      const src = nodeById.get(r.sourceId);
      return src && inferSubNodePortKind(src.type) === "ai_memory";
    });
    if (memories.length > 1) {
      issues.push({
        code: "invalid-config",
        level: "error",
        nodeId: agentId,
        message: "Only 1 Memory sub-node can be connected to an AI Agent.",
      });
    }
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
      if (isStickyNoteType(node.type)) continue;
      if (!reachableSet.has(node.id)) {
        issues.push({
          code: "unreachable-node",
          level: "error",
          nodeId: node.id,
          message: isAiSubNodeType(node.type)
            ? "Connect this AI sub-node to an AI Agent's bottom port."
            : "Nothing connects into this node from a trigger.",
        });
      }
    }
  }

  // Per-node config validation.
  for (const node of nodes) {
    if (isStickyNoteType(node.type)) continue;
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
