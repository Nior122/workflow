import { beforeEach, describe, expect, it } from "vitest";
import { useWorkflowStore } from "../workflowStore";
import { createFlowNode, resetNodeIdCounter } from "@/lib/engine/registry";
import { createWorkflow } from "@/types/workflow";
import { RUN_HISTORY_LIMIT } from "@/config/constants";
import type { RunResult } from "@/types/run";

/** A fresh single-workflow baseline, built per test so nothing leaks between them. */
function baseline() {
  const workflow = createWorkflow("default", "Untitled workflow");
  return {
    nodes: [],
    edges: [],
    past: [],
    future: [],
    runHistory: [],
    workflowName: workflow.name,
    workflows: [workflow],
    activeWorkflowId: workflow.id,
    lastConnectionError: null,
  };
}

beforeEach(() => {
  resetNodeIdCounter();
  useWorkflowStore.setState(baseline());
});

/** Add n nodes through the real action so each is recorded in history. */
function addNodes(count: number): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = useWorkflowStore.getState().addNode("action.aiPrompt", { x: index * 100, y: 0 });
    if (id) ids.push(id);
  }
  return ids;
}

function makeRun(index: number): RunResult {
  return {
    id: `run-${index}`,
    workflowId: "wf-1",
    workflowName: "Untitled workflow",
    status: "completed",
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
    durationMs: 500,
    speed: 1,
    steps: [],
    edges: [],
  };
}

describe("undo / redo", () => {
  it("starts with nothing to undo or redo", () => {
    expect(useWorkflowStore.getState().canUndo()).toBe(false);
    expect(useWorkflowStore.getState().canRedo()).toBe(false);
  });

  it("undo reverses the most recent change", () => {
    addNodes(2);
    expect(useWorkflowStore.getState().nodes).toHaveLength(2);

    useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    expect(useWorkflowStore.getState().canRedo()).toBe(true);
  });

  it("redo re-applies what undo removed", () => {
    addNodes(2);
    const after = useWorkflowStore.getState().nodes.map((node) => node.id);

    useWorkflowStore.getState().undo();
    useWorkflowStore.getState().redo();

    expect(useWorkflowStore.getState().nodes.map((node) => node.id)).toEqual(after);
  });

  it("walks all the way back to an empty canvas and stops there", () => {
    addNodes(3);

    for (let index = 0; index < 10; index += 1) useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
    expect(useWorkflowStore.getState().canUndo()).toBe(false);
  });

  it("clears the redo stack when a new change is made", () => {
    addNodes(2);
    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().canRedo()).toBe(true);

    useWorkflowStore.getState().addNode("action.delay", { x: 0, y: 0 });

    expect(useWorkflowStore.getState().canRedo()).toBe(false);
  });

  it("is a no-op when there is no history", () => {
    const before = useWorkflowStore.getState().nodes;
    useWorkflowStore.getState().undo();
    useWorkflowStore.getState().redo();
    expect(useWorkflowStore.getState().nodes).toBe(before);
  });

  it("caps the history so it cannot grow without bound", () => {
    addNodes(90);

    // 89 snapshots survive (the first add had no prior state to push).
    expect(useWorkflowStore.getState().past.length).toBeLessThanOrEqual(60);
  });
});

describe("duplicateSelection", () => {
  it("copies the selected nodes and offsets them", () => {
    const [first] = addNodes(1);
    useWorkflowStore.setState({
      nodes: useWorkflowStore.getState().nodes.map((node) => ({
        ...node,
        selected: node.id === first,
      })),
    });

    useWorkflowStore.getState().duplicateSelection();

    const nodes = useWorkflowStore.getState().nodes;
    expect(nodes).toHaveLength(2);

    const copy = nodes.find((node) => node.id !== first)!;
    expect(copy.id).toContain(`${first}-copy-`);
    expect(copy.data.label).toContain("(copy)");
    expect(copy.position.x).toBe(nodes[0].position.x + 32);
  });

  it("reconnects edges that ran between two duplicated nodes", () => {
    const [a, b] = addNodes(2);
    useWorkflowStore.setState({
      nodes: useWorkflowStore.getState().nodes.map((node) => ({ ...node, selected: true })),
    });
    useWorkflowStore.getState().onConnect({
      source: a,
      sourceHandle: "out",
      target: b,
      targetHandle: "in",
    });
    useWorkflowStore.setState({
      nodes: useWorkflowStore.getState().nodes.map((node) => ({ ...node, selected: true })),
    });

    useWorkflowStore.getState().duplicateSelection();

    const edges = useWorkflowStore.getState().edges;
    expect(edges).toHaveLength(2);
    const copiedEdge = edges.find((edge) => edge.source.includes("-copy-"))!;
    expect(copiedEdge.target).toContain("-copy-");
  });

  it("does nothing when nothing is selected", () => {
    addNodes(1);
    const before = useWorkflowStore.getState().nodes;
    useWorkflowStore.getState().duplicateSelection();
    expect(useWorkflowStore.getState().nodes).toBe(before);
  });

  it("is undoable", () => {
    addNodes(1);
    useWorkflowStore.setState({
      nodes: useWorkflowStore.getState().nodes.map((node) => ({ ...node, selected: true })),
    });

    useWorkflowStore.getState().duplicateSelection();
    expect(useWorkflowStore.getState().nodes).toHaveLength(2);

    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });
});

describe("replaceGraph", () => {
  it("swaps the whole graph and renames the workflow", () => {
    addNodes(3);

    const fresh = [createFlowNode("output.log", { x: 0, y: 0 })];
    useWorkflowStore.getState().replaceGraph(fresh, [], "Loaded template");

    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.edges).toHaveLength(0);
    expect(state.workflowName).toBe("Loaded template");
  });

  it("keeps the current name when none is given", () => {
    addNodes(1);
    useWorkflowStore.getState().replaceGraph([], []);
    expect(useWorkflowStore.getState().workflowName).toBe("Untitled workflow");
  });

  it("is undoable back to the previous graph", () => {
    addNodes(2);
    useWorkflowStore.getState().replaceGraph([createFlowNode("output.log", { x: 0, y: 0 })], []);

    useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().nodes).toHaveLength(2);
  });
});

describe("multiple workflows", () => {
  it("creates an empty workflow and makes it active", () => {
    addNodes(2);

    const id = useWorkflowStore.getState().createNewWorkflow("Second");

    const state = useWorkflowStore.getState();
    expect(id).toBeTruthy();
    expect(state.workflows).toHaveLength(2);
    expect(state.activeWorkflowId).toBe(id);
    expect(state.workflowName).toBe("Second");
    expect(state.nodes).toHaveLength(0);
  });

  it("folds the live graph into the workflow being left when switching", () => {
    addNodes(2);
    const firstId = useWorkflowStore.getState().activeWorkflowId;
    const secondId = useWorkflowStore.getState().createNewWorkflow("Second");
    addNodes(1);

    useWorkflowStore.getState().switchWorkflow(firstId);

    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(
      state.workflows.find((workflow) => workflow.id === secondId)!.nodes,
    ).toHaveLength(1);
  });

  it("ignores a switch to an unknown id or to itself", () => {
    addNodes(2);
    const before = useWorkflowStore.getState().nodes;

    useWorkflowStore.getState().switchWorkflow("does-not-exist");
    expect(useWorkflowStore.getState().nodes).toBe(before);

    useWorkflowStore.getState().switchWorkflow(useWorkflowStore.getState().activeWorkflowId);
    expect(useWorkflowStore.getState().nodes).toBe(before);
  });

  it("refuses to delete the last remaining workflow", () => {
    const onlyId = useWorkflowStore.getState().activeWorkflowId;
    useWorkflowStore.getState().deleteWorkflow(onlyId);

    expect(useWorkflowStore.getState().workflows).toHaveLength(1);
  });

  it("deleting the active workflow activates another one", () => {
    const firstId = useWorkflowStore.getState().activeWorkflowId;
    const secondId = useWorkflowStore.getState().createNewWorkflow("Second");

    useWorkflowStore.getState().deleteWorkflow(secondId);

    const state = useWorkflowStore.getState();
    expect(state.workflows).toHaveLength(1);
    expect(state.activeWorkflowId).toBe(firstId);
  });

  it("deleting an inactive workflow leaves the active one alone", () => {
    addNodes(1);
    const activeBefore = useWorkflowStore.getState().activeWorkflowId;
    const otherId = useWorkflowStore.getState().createNewWorkflow("Second");
    useWorkflowStore.getState().switchWorkflow(activeBefore);

    useWorkflowStore.getState().deleteWorkflow(otherId);

    expect(useWorkflowStore.getState().activeWorkflowId).toBe(activeBefore);
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it("snapshotWorkflows reflects the live graph for the active workflow only", () => {
    addNodes(2);
    useWorkflowStore.setState({ workflowName: "Renamed" });
    const otherId = useWorkflowStore.getState().createNewWorkflow("Empty one");
    useWorkflowStore.getState().switchWorkflow(useWorkflowStore.getState().workflows[0].id);

    const snapshot = useWorkflowStore.getState().snapshotWorkflows();
    const active = snapshot.find((workflow) => workflow.id !== otherId)!;

    expect(active.name).toBe("Renamed");
    expect(active.nodes).toHaveLength(2);
    expect(snapshot.find((workflow) => workflow.id === otherId)!.nodes).toHaveLength(0);
  });

  it("hydrate adopts the given workflows and falls back to the first when the id is stale", () => {
    const workflows = [
      createWorkflow("wf-a", "Alpha", { nodes: [createFlowNode("output.log", { x: 0, y: 0 })] }),
      createWorkflow("wf-b", "Beta"),
    ];

    useWorkflowStore.getState().hydrate({ workflows, activeWorkflowId: "wf-b", runHistory: [] });
    expect(useWorkflowStore.getState().workflowName).toBe("Beta");

    useWorkflowStore.getState().hydrate({ workflows, activeWorkflowId: "nope", runHistory: [] });
    expect(useWorkflowStore.getState().activeWorkflowId).toBe("wf-a");
  });

  it("hydrate ignores an empty list rather than blanking the store", () => {
    addNodes(1);
    const before = useWorkflowStore.getState().nodes;

    useWorkflowStore.getState().hydrate({ workflows: [], activeWorkflowId: "x", runHistory: [] });

    expect(useWorkflowStore.getState().nodes).toBe(before);
  });
});

describe("run history", () => {
  it("newest first and capped at the limit", () => {
    for (let index = 0; index < RUN_HISTORY_LIMIT + 5; index += 1) {
      useWorkflowStore.getState().pushRun(makeRun(index));
    }

    const history = useWorkflowStore.getState().runHistory;
    expect(history).toHaveLength(RUN_HISTORY_LIMIT);
    expect(history[0].id).toBe(`run-${RUN_HISTORY_LIMIT + 4}`);
  });

  it("clearRunHistory empties it", () => {
    useWorkflowStore.getState().pushRun(makeRun(0));
    useWorkflowStore.getState().clearRunHistory();
    expect(useWorkflowStore.getState().runHistory).toHaveLength(0);
  });
});
