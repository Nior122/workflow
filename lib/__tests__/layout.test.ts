import { beforeEach, describe, expect, it } from "vitest";
import { autoLayout } from "../layout";
import { buildEdge, buildNode } from "../graph-builder";
import { resetNodeIdCounter } from "../engine/registry";

beforeEach(resetNodeIdCounter);

describe("autoLayout", () => {
  it("returns nothing for an empty graph", () => {
    expect(autoLayout([], []).nodes).toEqual([]);
  });

  it("places a linear chain in increasing columns", () => {
    const nodes = [
      buildNode("t1", "trigger.manual", undefined, { position: { x: 900, y: 900 } }),
      buildNode("a1", "action.aiPrompt", undefined, { position: { x: 0, y: 0 } }),
      buildNode("o1", "output.log"),
    ];
    const edges = [buildEdge("t1", "a1"), buildEdge("a1", "o1")];

    const result = autoLayout(nodes, edges);
    const xOf = (id: string) => result.nodes.find((node) => node.id === id)!.position.x;

    expect(xOf("t1")).toBeLessThan(xOf("a1"));
    expect(xOf("a1")).toBeLessThan(xOf("o1"));
  });

  it("gives parallel branches the same column", () => {
    const nodes = [
      buildNode("t1", "trigger.manual"),
      buildNode("a1", "action.aiPrompt"),
      buildNode("a2", "action.textFormatter"),
      buildNode("o1", "output.log"),
    ];
    const edges = [
      buildEdge("t1", "a1"),
      buildEdge("t1", "a2"),
      buildEdge("a1", "o1"),
      buildEdge("a2", "o1"),
    ];

    const result = autoLayout(nodes, edges);
    const yOf = (id: string) => result.nodes.find((node) => node.id === id)!.position.y;

    expect(yOf("a1")).not.toBe(yOf("a2"));
    expect(
      result.nodes.find((node) => node.id === "a1")!.position.x,
    ).toBe(result.nodes.find((node) => node.id === "a2")!.position.x);
  });

  it("does not overlap nodes in the same column", () => {
    const nodes = [
      buildNode("t1", "trigger.manual"),
      buildNode("a1", "action.aiPrompt"),
      buildNode("a2", "action.textFormatter"),
      buildNode("a3", "action.delay"),
    ];
    const edges = [buildEdge("t1", "a1"), buildEdge("t1", "a2"), buildEdge("t1", "a3")];

    const result = autoLayout(nodes, edges);
    const ys = result.nodes
      .filter((node) => node.id !== "t1")
      .map((node) => node.position.y)
      .sort((a, b) => a - b);

    for (let index = 1; index < ys.length; index += 1) {
      expect(ys[index] - ys[index - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  it("centres a single-node column against a taller one", () => {
    const nodes = [
      buildNode("t1", "trigger.manual"),
      buildNode("a1", "action.aiPrompt"),
      buildNode("a2", "action.textFormatter"),
      buildNode("o1", "output.log"),
    ];
    const edges = [
      buildEdge("t1", "a1"),
      buildEdge("t1", "a2"),
      buildEdge("a1", "o1"),
      buildEdge("a2", "o1"),
    ];

    const result = autoLayout(nodes, edges);
    const yOf = (id: string) => result.nodes.find((node) => node.id === id)!.position.y;
    const branchMidpoint = (yOf("a1") + yOf("a2")) / 2;

    // The trigger and the merge sit on the vertical centre of the branch pair.
    expect(Math.abs(yOf("t1") - branchMidpoint)).toBeLessThan(1);
    expect(Math.abs(yOf("o1") - branchMidpoint)).toBeLessThan(1);
  });

  it("is deterministic — the same graph lays out identically twice", () => {
    const build = () => [
      buildNode("t1", "trigger.manual"),
      buildNode("a1", "action.aiPrompt"),
      buildNode("o1", "output.log"),
    ];
    const edges = [buildEdge("t1", "a1"), buildEdge("a1", "o1")];

    resetNodeIdCounter();
    const first = autoLayout(build(), edges).nodes.map((node) => node.position);
    resetNodeIdCounter();
    const second = autoLayout(build(), edges).nodes.map((node) => node.position);

    expect(second).toEqual(first);
  });

  it("leaves positions alone when the graph has a cycle", () => {
    const nodes = [
      buildNode("a1", "action.aiPrompt", undefined, { position: { x: 11, y: 22 } }),
      buildNode("a2", "action.textFormatter", undefined, { position: { x: 33, y: 44 } }),
    ];
    const edges = [buildEdge("a1", "a2"), buildEdge("a2", "a1")];

    const result = autoLayout(nodes, edges);
    expect(result.nodes[0].position).toEqual({ x: 11, y: 22 });
    expect(result.nodes[1].position).toEqual({ x: 33, y: 44 });
  });

  it("reports a bounding box covering every node", () => {
    const nodes = [
      buildNode("t1", "trigger.manual"),
      buildNode("a1", "action.aiPrompt"),
      buildNode("o1", "output.log"),
    ];
    const edges = [buildEdge("t1", "a1"), buildEdge("a1", "o1")];

    const { bounds } = autoLayout(nodes, edges);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });
});
