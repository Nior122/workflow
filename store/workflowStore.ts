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
import {
  createFlowNode,
  getNodeDef,
  resetNodeIdCounter,
} from "@/lib/engine/registry";
import { createWorkflow, type Viewport, type Workflow } from "@/types/workflow";
import { DEFAULT_VIEWPORT, RUN_HISTORY_LIMIT } from "@/config/constants";
import type { RunResult } from "@/types/run";

/** Undo/redo unit. Viewport is deliberately excluded — undoing a pan is noise. */
type Snapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const HISTORY_LIMIT = 60;

type WorkflowState = {
  /** Saved workflows, including the active one. */
  workflows: Workflow[];
  activeWorkflowId: string;
  /** Live graph for the active workflow. */
  workflowName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  runHistory: RunResult[];

  past: Snapshot[];
  future: Snapshot[];

  lastConnectionError: string | null;

  // graph
  setWorkflowName: (name: string) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => string | null;
  updateNodeData: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  renameNode: (nodeId: string, label: string) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  replaceGraph: (nodes: FlowNode[], edges: FlowEdge[], name?: string) => void;
  clear: () => void;
  setViewport: (viewport: Viewport) => void;
  dismissConnectionError: () => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // workflows
  createNewWorkflow: (name?: string) => string;
  switchWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  hydrate: (input: {
    workflows: Workflow[];
    activeWorkflowId: string;
    runHistory: RunResult[];
  }) => void;
  /** Fold the live graph back into its workflow entry, for saving. */
  snapshotWorkflows: () => Workflow[];

  // runs
  pushRun: (result: RunResult) => void;
  clearRunHistory: () => void;
};

/** Can `connection` legally be made, given the port rules for each node type? */
function isValidConnectionTarget(
  nodes: readonly FlowNode[],
  connection: Connection,
): boolean {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.id === target.id) return false;
  if (!hasOutput(source.type as NodeType)) return false;
  if (!hasInput(target.type as NodeType)) return false;
  return connection.targetHandle === TARGET_HANDLE_IN;
}

let edgeCounter = 0;
let workflowCounter = 0;
/** True between the first and last position change of a single drag. */
let dragging = false;

/**
 * The store must open with the same single workflow `lib/utils/storage` persists,
 * otherwise `activeWorkflowId` points at nothing until hydration completes.
 */
/**
 * Fold the live graph back into the workflow being left.
 *
 * Both `createNewWorkflow` and `switchWorkflow` must do this, otherwise anything
 * drawn since the last switch is silently discarded.
 */
function foldActiveInto(
  workflows: Workflow[],
  activeWorkflowId: string,
  workflowName: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport: Viewport,
): Workflow[] {
  return workflows.map((workflow) =>
    workflow.id === activeWorkflowId
      ? { ...workflow, name: workflowName, nodes, edges, viewport, updatedAt: Date.now() }
      : workflow,
  );
}

const DEFAULT_WORKFLOW_ID = "default";
const DEFAULT_WORKFLOW_NAME = "Untitled workflow";

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [createWorkflow(DEFAULT_WORKFLOW_ID, DEFAULT_WORKFLOW_NAME)],
  activeWorkflowId: DEFAULT_WORKFLOW_ID,
  workflowName: DEFAULT_WORKFLOW_NAME,
  nodes: [],
  edges: [],
  viewport: { ...DEFAULT_VIEWPORT },
  runHistory: [],
  past: [],
  future: [],
  lastConnectionError: null,

  setWorkflowName: (workflowName) => set({ workflowName }),

  onNodesChange: (changes) =>
    set((state) => {
      // Coalesce a whole drag into one undo step: snapshot when it starts, not on
      // every frame.
      const startsDrag = changes.some(
        (change) => change.type === "position" && change.dragging === true,
      );
      const endsDrag = changes.some(
        (change) => change.type === "position" && change.dragging === false,
      );

      const base =
        startsDrag && !dragging
          ? {
              past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(
                -HISTORY_LIMIT,
              ),
              future: [],
            }
          : {};

      if (startsDrag) dragging = true;
      if (endsDrag) dragging = false;

      return { ...base, nodes: applyNodeChanges(changes, state.nodes) };
    }),

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
        past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
        future: [],
        edges: addEdge(edge, state.edges),
        lastConnectionError: null,
      };
    }),

  addNode: (type, position) => {
    const def = getNodeDef(type);
    if (!def) return null;

    const node = createFlowNode(type, position);
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
      future: [],
      nodes: [...state.nodes, node],
    }));
    return node.id;
  },

  updateNodeData: (nodeId, patch) =>
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
      future: [],
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
        past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
        future: [],
        nodes: state.nodes.filter((node) => !selectedNodeIds.has(node.id)),
        edges: state.edges.filter(
          (edge) =>
            !selectedEdgeIds.has(edge.id) &&
            !selectedNodeIds.has(edge.source) &&
            !selectedNodeIds.has(edge.target),
        ),
      };
    }),

  duplicateSelection: () =>
    set((state) => {
      const selected = state.nodes.filter((node) => node.selected);
      if (selected.length === 0) return {};

      const OFFSET = 32;
      const idMap = new Map<string, string>();

      const copies = selected.map((node) => {
        const copy = structuredClone(node);
        const newId = `${node.id}-copy-${Date.now().toString(36)}`;
        idMap.set(node.id, newId);
        return {
          ...copy,
          id: newId,
          position: { x: node.position.x + OFFSET, y: node.position.y + OFFSET },
          selected: true,
          data: { ...copy.data, label: `${copy.data.label} (copy)` },
        } as FlowNode;
      });

      // Reconnect edges that ran between two duplicated nodes.
      const copiedEdges = state.edges
        .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
        .map((edge) => {
          edgeCounter += 1;
          return {
            ...edge,
            id: `e-${edgeCounter}`,
            source: idMap.get(edge.source)!,
            target: idMap.get(edge.target)!,
            selected: false,
          };
        });

      return {
        past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
        future: [],
        nodes: [
          ...state.nodes.map((node) => ({ ...node, selected: false })),
          ...copies,
        ],
        edges: [...state.edges, ...copiedEdges],
      };
    }),

  replaceGraph: (nodes, edges, name) =>
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
      future: [],
      nodes,
      edges,
      ...(name ? { workflowName: name } : {}),
      lastConnectionError: null,
    })),

  clear: () =>
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
      future: [],
      nodes: [],
      edges: [],
      viewport: { ...DEFAULT_VIEWPORT },
      lastConnectionError: null,
    })),

  setViewport: (viewport) => set({ viewport }),

  dismissConnectionError: () => set({ lastConnectionError: null }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return {};
      return {
        past: state.past.slice(0, -1),
        future: [{ nodes: state.nodes, edges: state.edges }, ...state.future].slice(
          0,
          HISTORY_LIMIT,
        ),
        nodes: previous.nodes,
        edges: previous.edges,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      return {
        past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  createNewWorkflow: (name) => {
    workflowCounter += 1;
    const id = `wf-${Date.now().toString(36)}-${workflowCounter}`;
    const workflow = createWorkflow(id, name?.trim() || `${DEFAULT_WORKFLOW_NAME} ${workflowCounter}`);

    set((state) => ({
      // Save what is on screen before blanking the canvas.
      workflows: [
        ...foldActiveInto(
          state.workflows,
          state.activeWorkflowId,
          state.workflowName,
          state.nodes,
          state.edges,
          state.viewport,
        ),
        workflow,
      ],
      activeWorkflowId: id,
      workflowName: workflow.name,
      nodes: [],
      edges: [],
      past: [],
      future: [],
      viewport: { ...DEFAULT_VIEWPORT },
    }));
    return id;
  },

  switchWorkflow: (id) =>
    set((state) => {
      if (id === state.activeWorkflowId) return {};
      const target = state.workflows.find((workflow) => workflow.id === id);
      if (!target) return {};

      const workflows = foldActiveInto(
        state.workflows,
        state.activeWorkflowId,
        state.workflowName,
        state.nodes,
        state.edges,
        state.viewport,
      );

      resetNodeIdCounter();
      return {
        workflows,
        activeWorkflowId: id,
        workflowName: target.name,
        nodes: target.nodes,
        edges: target.edges,
        viewport: target.viewport ?? { ...DEFAULT_VIEWPORT },
        past: [],
        future: [],
      };
    }),

  deleteWorkflow: (id) =>
    set((state) => {
      if (state.workflows.length <= 1) return {};
      const remaining = state.workflows.filter((workflow) => workflow.id !== id);
      if (remaining.length === state.workflows.length) return {};

      if (state.activeWorkflowId !== id) return { workflows: remaining };

      const next = remaining[0];
      return {
        workflows: remaining,
        activeWorkflowId: next.id,
        workflowName: next.name,
        nodes: next.nodes,
        edges: next.edges,
        viewport: next.viewport ?? { ...DEFAULT_VIEWPORT },
        past: [],
        future: [],
      };
    }),

  hydrate: ({ workflows, activeWorkflowId, runHistory }) => {
    const active =
      workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0];
    if (!active) return;

    resetNodeIdCounter();
    set(() => ({
      workflows,
      activeWorkflowId: active.id,
      workflowName: active.name,
      nodes: active.nodes,
      edges: active.edges,
      viewport: active.viewport ?? { ...DEFAULT_VIEWPORT },
      runHistory: runHistory.slice(0, RUN_HISTORY_LIMIT),
      past: [],
      future: [],
    }));
  },

  snapshotWorkflows: () => {
    const state = get();
    return foldActiveInto(
      state.workflows,
      state.activeWorkflowId,
      state.workflowName,
      state.nodes,
      state.edges,
      state.viewport,
    );
  },

  pushRun: (result) =>
    set((state) => ({ runHistory: [result, ...state.runHistory].slice(0, RUN_HISTORY_LIMIT) })),

  clearRunHistory: () => set({ runHistory: [] }),
}));

/* ------------------------------------------------------------------ *
 * Narrow selectors
 * ------------------------------------------------------------------ */

export function useSelectedNode(): FlowNode | undefined {
  return useWorkflowStore((state) => state.nodes.find((node) => node.selected));
}

export function useNodeCount(): number {
  return useWorkflowStore((state) => state.nodes.length);
}

export function useIsEmptyCanvas(): boolean {
  return useWorkflowStore((state) => state.nodes.length === 0);
}

export function useWorkflows(): Workflow[] {
  return useWorkflowStore((state) => state.workflows);
}
