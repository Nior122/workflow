import { beforeEach, describe, expect, it } from "vitest";
import { useWorkflowStore } from "../workflowStore";
import { useRunStore } from "../runStore";
import { createWorkflow } from "@/types/workflow";
import { createFlowNode, resetNodeIdCounter } from "@/lib/engine/registry";
import type { FlowNode } from "@/types";

/**
 * Live run state (which node is running, which edges are glowing, the console's
 * step list) belongs to the workflow currently on screen. Run *history* does not
 * — that is deliberately kept across the session.
 *
 * Node ids restart from `node-1` after `resetNodeIdCounter()`, which both
 * `switchWorkflow` and `hydrate` call. So the same id legitimately refers to a
 * different node in a different workflow, and any status left behind is a lie.
 */

const initialWorkflow = useWorkflowStore.getState();
const initialRun = useRunStore.getState();

function nodeWithId(id: string): FlowNode {
  return { ...createFlowNode("output.log", { x: 0, y: 0 }), id };
}

beforeEach(() => {
  resetNodeIdCounter();
  useWorkflowStore.setState({ ...initialWorkflow, nodes: [], edges: [] });
  useRunStore.setState({
    ...initialRun,
    status: "idle",
    currentRunId: null,
    nodeStatuses: {},
    activeEdges: {},
    steps: [],
    expandedSteps: [],
    history: [],
    blockingMessage: null,
  });
});

describe("live run state does not leak between workflows", () => {
  const build = () => {
    const a = createWorkflow("wf-a", "A", { nodes: [nodeWithId("node-1")] });
    const b = createWorkflow("wf-b", "B", { nodes: [nodeWithId("node-1")] });
    useWorkflowStore.setState({
      workflows: [a, b],
      activeWorkflowId: "wf-a",
      workflowName: a.name,
      nodes: a.nodes,
      edges: [],
    });
    return { a, b };
  };

  it("clears a stale node status when switching workflows", () => {
    build();
    useRunStore.getState().beginRun("run-1", ["node-1"]);
    expect(useRunStore.getState().nodeStatuses["node-1"]).toBe("queued");

    useWorkflowStore.getState().switchWorkflow("wf-b");

    // wf-b's node-1 is a different node that has never run.
    expect(useRunStore.getState().nodeStatuses["node-1"]).toBeUndefined();
  });

  it("clears the console's step list when switching workflows", () => {
    build();
    useRunStore.getState().beginRun("run-1", ["node-1"]);
    useRunStore.getState().applyEvent({ kind: "node:running", nodeId: "node-1", at: 0 });
    expect(useRunStore.getState().status).toBe("running");

    useWorkflowStore.getState().switchWorkflow("wf-b");

    expect(useRunStore.getState().status).toBe("idle");
    expect(useRunStore.getState().currentRunId).toBeNull();
  });

  it("keeps run history across a switch — history is session-wide", () => {
    build();
    useRunStore.setState({
      history: [
        {
          id: "run-old",
          workflowId: "wf-a",
          workflowName: "A",
          status: "completed",
          startedAt: 0,
          endedAt: 10,
          durationMs: 10,
          speed: 1,
          steps: [],
          edges: [],
        },
      ],
    });

    useWorkflowStore.getState().switchWorkflow("wf-b");

    expect(useRunStore.getState().history).toHaveLength(1);
  });

  it("clears stale statuses when hydrating saved state", () => {
    build();
    useRunStore.getState().beginRun("run-1", ["node-1"]);

    useWorkflowStore.getState().hydrate({
      workflows: [createWorkflow("wf-c", "C", { nodes: [nodeWithId("node-1")] })],
      activeWorkflowId: "wf-c",
      runHistory: [],
    });

    expect(useRunStore.getState().nodeStatuses["node-1"]).toBeUndefined();
  });
});
