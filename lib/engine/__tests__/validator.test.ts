import { beforeEach, describe, expect, it } from "vitest";
import { issuesByNode, validateWorkflow } from "../validator";
import { edge, node, resetCounters } from "./helpers";

beforeEach(resetCounters);

const codes = (result: ReturnType<typeof validateWorkflow>) =>
  result.issues.map((issue) => issue.code);

describe("validateWorkflow", () => {
  it("rejects an empty canvas", () => {
    const result = validateWorkflow([], []);
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual(["empty-workflow"]);
  });

  it("accepts a minimal valid flow", () => {
    const nodes = [node("t1", "trigger.manual"), node("o1", "output.log")];
    const result = validateWorkflow(nodes, [edge("t1", "o1")]);

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.waves).toEqual([["t1"], ["o1"]]);
  });

  it("rejects a flow with no trigger", () => {
    const nodes = [node("a1", "action.aiPrompt"), node("o1", "output.log")];
    const result = validateWorkflow(nodes, [edge("a1", "o1")]);

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("missing-trigger");
  });

  it("warns but does not block when several triggers exist", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("t2", "trigger.webhook"),
      node("o1", "output.log"),
    ];
    const edges = [edge("t1", "o1"), edge("t2", "o1")];
    const result = validateWorkflow(nodes, edges);

    const multi = result.issues.find((issue) => issue.code === "multiple-triggers");
    expect(multi?.level).toBe("warning");
    expect(result.valid).toBe(true);
  });

  it("reports a cycle against the nodes involved", () => {
    const nodes = [node("t1", "trigger.manual"), node("a1", "action.aiPrompt"), node("a2", "action.textFormatter")];
    const edges = [edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a1")];
    const result = validateWorkflow(nodes, edges);

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("cycle-detected");
    expect(result.waves).toEqual([]);
    const cycleNodes = result.issues
      .filter((issue) => issue.code === "cycle-detected")
      .map((issue) => issue.nodeId)
      .sort();
    expect(cycleNodes).toEqual(["a1", "a2"]);
  });

  it("reports a node nothing connects into", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("o1", "output.log"),
      node("orphan", "output.log"),
    ];
    const result = validateWorkflow(nodes, [edge("t1", "o1")]);

    expect(result.valid).toBe(false);
    const orphanIssue = result.issues.find((issue) => issue.code === "unreachable-node");
    expect(orphanIssue?.nodeId).toBe("orphan");
  });

  it("reports a dangling connection", () => {
    const nodes = [node("t1", "trigger.manual")];
    const result = validateWorkflow(nodes, [edge("t1", "ghost")]);

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("dangling-edge");
  });

  it("attaches config errors to the offending node", () => {
    const nodes = [
      node("t1", "trigger.manual"),
      node("a1", "action.aiPrompt", { promptTemplate: "  " }),
    ];
    const result = validateWorkflow(nodes, [edge("t1", "a1")]);

    expect(result.valid).toBe(false);
    const configIssue = result.issues.find(
      (issue) => issue.code === "missing-required-config",
    );
    expect(configIssue?.nodeId).toBe("a1");
    expect(configIssue?.field).toBe("config.promptTemplate");
  });

  it("reports invalid trigger JSON", () => {
    const nodes = [node("t1", "trigger.manual", { payloadJson: "{oops" })];
    const result = validateWorkflow(nodes, []);

    expect(codes(result)).toContain("invalid-json");
  });

  it("does not report reachability when a cycle already explains the graph", () => {
    const nodes = [node("a1", "action.aiPrompt"), node("a2", "action.textFormatter")];
    const result = validateWorkflow(nodes, [edge("a1", "a2"), edge("a2", "a1")]);

    expect(codes(result)).not.toContain("unreachable-node");
  });
});

describe("issuesByNode", () => {
  it("groups issues under their node id and drops graph-wide ones", () => {
    const nodes = [node("t1", "trigger.manual", { payloadJson: "{oops" }), node("a1", "action.aiPrompt", { promptTemplate: "" })];
    const result = validateWorkflow(nodes, [edge("t1", "a1")]);
    const grouped = issuesByNode(result.issues);

    expect(grouped.get("t1")?.[0].code).toBe("invalid-json");
    expect(grouped.get("a1")?.[0].code).toBe("missing-required-config");
  });
});
