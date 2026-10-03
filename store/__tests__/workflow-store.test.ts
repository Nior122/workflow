import { beforeEach, describe, expect, it } from "vitest";
import { useWorkflowStore } from "../workflowStore";
import { createFlowNode, resetNodeIdCounter } from "@/lib/engine/registry";
import { TARGET_HANDLE_IN } from "@/types/edges";
import type { FlowNode, NodeType } from "@/types/nodes";

const initialState = useWorkflowStore.getState();

function seed(types: NodeType[]): FlowNode[] {
  return types.map((type, index) => createFlowNode(type, { x: index * 300, y: 0 }));
}

beforeEach(() => {
  resetNodeIdCounter();
  useWorkflowStore.setState({ ...initialState, nodes: [], edges: [], lastConnectionError: null });
});

function connect(nodes: FlowNode[], source: number, target: number) {
  useWorkflowStore.setState({ nodes });
  useWorkflowStore.getState().onConnect({
    source: nodes[source].id,
    sourceHandle: "out",
    target: nodes[target].id,
    targetHandle: TARGET_HANDLE_IN,
  });
  return useWorkflowStore.getState();
}

describe("addNode", () => {
  it("appends a node and returns its id", () => {
    const id = useWorkflowStore.getState().addNode("trigger.manual", { x: 0, y: 0 });

    expect(id).toBeTruthy();
    const { nodes } = useWorkflowStore.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(id);
    expect(nodes[0].type).toBe("trigger.manual");
  });

  it("returns null for a node type that is not implemented yet", () => {
    expect(useWorkflowStore.getState().addNode("action.condition", { x: 0, y: 0 })).toBeNull();
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
  });
});

describe("connection rules", () => {
  it("connects an action's output to an output node's input", () => {
    const nodes = seed(["trigger.manual", "action.aiPrompt", "output.log"]);
    const state = connect(nodes, 1, 2);

    expect(state.edges).toHaveLength(1);
    expect(state.lastConnectionError).toBeNull();
    expect(state.edges[0].source).toBe(nodes[1].id);
    expect(state.edges[0].target).toBe(nodes[2].id);
    expect(state.edges[0].type).toBe("animated-flow");
  });

  it("connects a trigger to an action", () => {
    const nodes = seed(["trigger.manual", "action.aiPrompt"]);
    expect(connect(nodes, 0, 1).edges).toHaveLength(1);
  });

  it("refuses to connect into a trigger, which has no input handle", () => {
    const nodes = seed(["trigger.manual", "action.aiPrompt"]);
    const state = connect(nodes, 1, 0);

    expect(state.edges).toHaveLength(0);
    expect(state.lastConnectionError).toMatch(/cannot accept this connection/);
  });

  it("refuses to connect out of an output node, which has no output handle", () => {
    const nodes = seed(["output.log", "output.log"]);
    const state = connect(nodes, 0, 1);

    expect(state.edges).toHaveLength(0);
    expect(state.lastConnectionError).toBeTruthy();
  });

  it("refuses a self-connection", () => {
    const nodes = seed(["action.aiPrompt"]);
    const state = connect(nodes, 0, 0);

    expect(state.edges).toHaveLength(0);
  });

  it("refuses a connection that does not land on the input handle", () => {
    const nodes = seed(["action.aiPrompt", "output.log"]);
    useWorkflowStore.setState({ nodes });
    useWorkflowStore.getState().onConnect({
      source: nodes[0].id,
      sourceHandle: "out",
      target: nodes[1].id,
      targetHandle: "somewhere-else",
    });

    const state = useWorkflowStore.getState();
    expect(state.edges).toHaveLength(0);
    expect(state.lastConnectionError).toBeTruthy();
  });

  it("clears a previous error once a valid connection is made", () => {
    const bad = connect(seed(["trigger.manual", "action.aiPrompt"]), 1, 0);
    expect(bad.lastConnectionError).toBeTruthy();

    const nodes = seed(["trigger.manual", "action.aiPrompt"]);
    const good = connect(nodes, 0, 1);
    expect(good.lastConnectionError).toBeNull();
    expect(good.edges).toHaveLength(1);
  });
});

describe("deleteSelection", () => {
  it("removes selected nodes and every edge touching them", () => {
    const nodes = seed(["trigger.manual", "action.aiPrompt", "output.log"]);
    const connected = connect(nodes, 0, 1);
    useWorkflowStore.getState().onConnect({
      source: connected.nodes[1].id,
      sourceHandle: "out",
      target: connected.nodes[2].id,
      targetHandle: TARGET_HANDLE_IN,
    });
    expect(useWorkflowStore.getState().edges).toHaveLength(2);

    // Select the middle node.
    useWorkflowStore.setState({
      nodes: useWorkflowStore
        .getState()
        .nodes.map((node) => ({ ...node, selected: node.id === connected.nodes[1].id })),
    });

    useWorkflowStore.getState().deleteSelection();

    const after = useWorkflowStore.getState();
    expect(after.nodes).toHaveLength(2);
    expect(after.nodes.map((node) => node.id)).not.toContain(connected.nodes[1].id);
    // Both edges touched the deleted node, so both are gone.
    expect(after.edges).toHaveLength(0);
  });

  it("is a no-op when nothing is selected", () => {
    const nodes = seed(["trigger.manual", "output.log"]);
    useWorkflowStore.setState({ nodes });

    useWorkflowStore.getState().deleteSelection();
    expect(useWorkflowStore.getState().nodes).toHaveLength(2);
  });
});

describe("renameNode", () => {
  it("trims whitespace and applies the new label", () => {
    const nodes = seed(["output.log"]);
    useWorkflowStore.setState({ nodes });

    useWorkflowStore.getState().renameNode(nodes[0].id, "  Lead alert  ");
    expect(useWorkflowStore.getState().nodes[0].data.label).toBe("Lead alert");
  });

  it("ignores an empty name rather than blanking the node", () => {
    const nodes = seed(["output.log"]);
    useWorkflowStore.setState({ nodes });

    useWorkflowStore.getState().renameNode(nodes[0].id, "   ");
    expect(useWorkflowStore.getState().nodes[0].data.label).toBe("Log Output");
  });
});

describe("clear", () => {
  it("empties the graph and resets the viewport", () => {
    const nodes = seed(["trigger.manual", "output.log"]);
    useWorkflowStore.setState({ nodes, viewport: { x: 500, y: 500, zoom: 2 } });

    useWorkflowStore.getState().clear();

    const state = useWorkflowStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
