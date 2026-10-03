import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import {
  createFlowEdge,
  TARGET_HANDLE_IN,
  isSourceHandle,
  type FlowEdge,
} from "@/types/edges";
import {
  hasInput,
  hasOutput,
  type FlowNode,
  type FlowNodeData,
  type NodeType,
} from "@/types/nodes";
import { createFlowNode, getNodeDef } from "@/lib/engine/registry";
import type { Viewport } from "@/types/workflow";
import { DEFAULT_VIEWPORT } from "@/config/constants";

type WorkflowState = {
  workflowName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  /** Ids of nodes that could not accept a connection, used to show a hint. */
  lastConnectionError: string | null;

  setWorkflowName: (name: string) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => string | null;
  updateNodeData: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  renameNode: (nodeId: string, label: string) => void;
  deleteSelection: () => void;
  replaceGraph: (nodes: FlowNode[], edges: FlowEdge[], name?: string) => void;
  clear: () => void;
  setViewport: (viewport: Viewport) => void;
  dismissConnectionError: () => void;
};

/** Can `connection` legally be made, given the port rules for each node type? */
function isValidConnectionTarget(
  nodes: readonly FlowNode[],
  connection: Connection,
): boolean {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.id === target.id) return false;

  // Triggers have no input, outputs have no output.
  if (!hasOutput(source.type as NodeType)) return false;
  if (!hasInput(target.type as NodeType)) return false;

  // A connection must land on the target's input handle.
  return connection.targetHandle === TARGET_HANDLE_IN;
}

let edgeCounter = 0;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowName: "Untitled workflow",
  nodes: [],
  edges: [],
  viewport: { ...DEFAULT_VIEWPORT },
  lastConnectionError: null,

  setWorkflowName: (workflowName) => set({ workflowName }),

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) =>
    set((state) => {
      if (!isValidConnectionTarget(state.nodes, connection)) {
        const target = state.nodes.find((node) => node.id === connection.target);
        return {
          lastConnectionError: target
            ? `${target.data.label} cannot accept this connection.`
            : "That connection is not valid.",
        };
      }

      edgeCounter += 1;
      const sourceHandle = isSourceHandle(connection.sourceHandle)
        ? connection.sourceHandle
        : "out";

      const label =
        sourceHandle === "true" ? "true" : sourceHandle === "false" ? "false" : undefined;

      const edge = createFlowEdge(`e-${edgeCounter}`, connection.source, connection.target, {
        sourceHandle,
        label,
      });

      return {
        edges: addEdge(edge, state.edges),
        lastConnectionError: null,
      };
    }),

  addNode: (type, position) => {
    const def = getNodeDef(type);
    if (!def) return null;

    const node = createFlowNode(type, position);
    set((state) => ({ nodes: [...state.nodes, node] }));
    return node.id;
  },

  updateNodeData: (nodeId, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? ({ ...node, data: { ...node.data, ...patch } } as FlowNode) : node,
      ),
    })),

  renameNode: (nodeId, label) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    get().updateNodeData(nodeId, { label: trimmed });
  },

  deleteSelection: () =>
    set((state) => {
      const selectedNodeIds = new Set(
        state.nodes.filter((node) => node.selected).map((node) => node.id),
      );
      const selectedEdgeIds = new Set(
        state.edges.filter((edge) => edge.selected).map((edge) => edge.id),
      );
      if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return {};

      return {
        nodes: state.nodes.filter((node) => !selectedNodeIds.has(node.id)),
        // Drop edges that were selected or that touched a deleted node.
        edges: state.edges.filter(
          (edge) =>
            !selectedEdgeIds.has(edge.id) &&
            !selectedNodeIds.has(edge.source) &&
            !selectedNodeIds.has(edge.target),
        ),
      };
    }),

  replaceGraph: (nodes, edges, name) =>
    set(() => ({
      nodes,
      edges,
      ...(name ? { workflowName: name } : {}),
      lastConnectionError: null,
    })),

  clear: () =>
    set(() => ({
      nodes: [],
      edges: [],
      viewport: { ...DEFAULT_VIEWPORT },
      lastConnectionError: null,
    })),

  setViewport: (viewport) => set({ viewport }),

  dismissConnectionError: () => set({ lastConnectionError: null }),
}));

/* ------------------------------------------------------------------ *
 * Narrow selectors — keep re-renders scoped.
 * ------------------------------------------------------------------ */

export function useSelectedNode(): FlowNode | undefined {
  return useWorkflowStore((state) => state.nodes.find((node) => node.selected));
}

export function useSelectedNodeIds(): string[] {
  return useWorkflowStore((state) =>
    state.nodes.filter((node) => node.selected).map((node) => node.id),
  );
}

export function useNodeCount(): number {
  return useWorkflowStore((state) => state.nodes.length);
}

export function useIsEmptyCanvas(): boolean {
  return useWorkflowStore((state) => state.nodes.length === 0);
}
