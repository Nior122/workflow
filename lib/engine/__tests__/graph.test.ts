import { beforeEach, describe, expect, it } from "vitest";
import { analyzeGraph, isMergePoint } from "../graph";
import { edge, node, resetCounters } from "./helpers";

beforeEach(resetCounters);

describe("analyzeGraph", () => {
  it("reports an empty graph as valid with no waves", () => {
    const analysis = analyzeGraph([], []);
    expect(analysis.waves).toEqual([]);
    expect(analysis.hasCycle).toBe(false);
    expect(analysis.triggerIds).toEqual([]);
  });

  it("orders a linear chain into one node per wave", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("a1", "action.aiPrompt"),
      node("o1", "output.log"),
    ];
    const edges = [edge("t1", "a1"), edge("a1", "o1")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.waves).toEqual([["t1"], ["a1"], ["o1"]]);
    expect(analysis.hasCycle).toBe(false);
  });

  it("puts independent branches in the same wave", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("a1", "action.aiPrompt"),
      node("a2", "action.textFormatter"),
      node("o1", "output.log"),
    ];
    const edges = [edge("t1", "a1"), edge("t1", "a2"), edge("a1", "o1"), edge("a2", "o1")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.waves[0]).toEqual(["t1"]);
    expect(analysis.waves[1].sort()).toEqual(["a1", "a2"]);
    expect(analysis.waves[2]).toEqual(["o1"]);
  });

  it("detects a two-node cycle and names the participants", () => {
    const nodes = [node("t1", "trigger.manual"), node("a1", "action.aiPrompt"), node("a2", "action.textFormatter")];
    const edges = [edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a1")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.hasCycle).toBe(true);
    expect(analysis.waves).toEqual([]);
    expect(analysis.cycleNodeIds.sort()).toEqual(["a1", "a2"]);
  });

  it("detects a self-loop", () => {
    const nodes = [node("t1", "trigger.manual"), node("a1", "action.aiPrompt")];
    const edges = [edge("t1", "a1"), edge("a1", "a1")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.hasCycle).toBe(true);
    expect(analysis.cycleNodeIds).toEqual(["a1"]);
  });

  it("identifies triggers as nodes whose type takes no input", () => {
    const nodes = [node("t1", "trigger.manual"), node("t2", "trigger.webhook"), node("o1", "output.log")];
    expect(analyzeGraph(nodes, []).triggerIds.sort()).toEqual(["t1", "t2"]);
  });

  it("computes forward reachability from triggers", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("a1", "action.aiPrompt"),
      node("orphan", "output.log"),
    ];
    const edges = [edge("t1", "a1")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.reachableFromTriggers.sort()).toEqual(["a1", "t1"]);
    expect(analysis.reachableFromTriggers).not.toContain("orphan");
  });

  it("flags edges that point at a node not on the canvas", () => {
    const nodes = [node("t1", "trigger.manual")];
    const edges = [edge("t1", "ghost")];

    const analysis = analyzeGraph(nodes, edges);
    expect(analysis.danglingEdgeIds).toHaveLength(1);
    // A dangling edge must not create an incoming entry for a nonexistent node.
    expect(analysis.incoming.has("ghost")).toBe(false);
  });

  it("sorts each wave so runs are reproducible", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("zz", "action.aiPrompt"),
      node("aa", "action.textFormatter"),
    ];
    const edges = [edge("t1", "zz"), edge("t1", "aa")];

    expect(analyzeGraph(nodes, edges).waves[1]).toEqual(["aa", "zz"]);
  });
});

describe("isMergePoint", () => {
  it("is true only when more than one edge arrives", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("a1", "action.aiPrompt"),
      node("a2", "action.textFormatter"),
      node("m1", "output.log"),
    ];
    const edges = [edge("t1", "a1"), edge("t1", "a2"), edge("a1", "m1"), edge("a2", "m1")];
    const analysis = analyzeGraph(nodes, edges);

    expect(isMergePoint(analysis, "m1")).toBe(true);
    expect(isMergePoint(analysis, "a1")).toBe(false);
  });
});
