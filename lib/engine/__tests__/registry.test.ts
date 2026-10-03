import { beforeEach, describe, expect, it } from "vitest";
import {
  clampLatency,
  createFlowNode,
  getNodeDef,
  isNodeTypeImplemented,
  listNodeDefs,
  requireNodeDef,
  resetNodeIdCounter,
} from "../registry";
import { LATENCY_MAX_MS, LATENCY_MIN_MS, NODE_WIDTH } from "@/config/constants";
import type { NodeType } from "@/types/nodes";

describe("node registry", () => {
  it("exposes exactly the three node types implemented in Phase 1", () => {
    expect(listNodeDefs().map((def) => def.type)).toEqual([
      "trigger.manual",
      "action.aiPrompt",
      "output.log",
    ]);
  });

  it("reports unimplemented node types as unavailable rather than half-present", () => {
    expect(isNodeTypeImplemented("trigger.manual")).toBe(true);
    expect(isNodeTypeImplemented("action.condition")).toBe(false);
    expect(getNodeDef("action.condition")).toBeUndefined();
  });

  it("throws when an unimplemented type is demanded", () => {
    expect(() => requireNodeDef("action.condition")).toThrow(/No node definition/);
  });

  it.each([
    ["trigger.manual", { inputs: 0, outputs: 1 }],
    ["action.aiPrompt", { inputs: 1, outputs: 1 }],
    ["output.log", { inputs: 1, outputs: 0 }],
  ] as [NodeType, { inputs: number; outputs: number }][])(
    "%s has the port shape its category requires",
    (type, expected) => {
      const def = requireNodeDef(type);
      expect(def.inputs).toHaveLength(expected.inputs);
      expect(def.outputs).toHaveLength(expected.outputs);
      expect(def.category).toBe(def.category); // sanity: category is set
    },
  );

  it("keeps every node's latency inside the visible-animation range", () => {
    for (const def of listNodeDefs()) {
      expect(def.latencyMs).toBeGreaterThanOrEqual(LATENCY_MIN_MS);
      expect(def.latencyMs).toBeLessThanOrEqual(LATENCY_MAX_MS);
    }
  });

  it("clamps out-of-range latency", () => {
    expect(clampLatency(1)).toBe(LATENCY_MIN_MS);
    expect(clampLatency(9999)).toBe(LATENCY_MAX_MS);
    expect(clampLatency(700)).toBe(700);
  });
});

describe("createFlowNode", () => {
  beforeEach(() => resetNodeIdCounter());

  it("builds a node with its type's default config", () => {
    const node = createFlowNode("trigger.manual", { x: 10, y: 20 });

    expect(node.type).toBe("trigger.manual");
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.width).toBe(NODE_WIDTH);
    expect(node.data.label).toBe("Manual Trigger");
    expect(node.data.simulateFailure).toBe(false);
  });

  it("deep-clones the default config so nodes do not share mutable state", () => {
    const a = createFlowNode("action.aiPrompt", { x: 0, y: 0 });
    const b = createFlowNode("action.aiPrompt", { x: 0, y: 0 });

    expect(a.data.config).not.toBe(b.data.config);

    a.data.config.promptTemplate = "mutated";
    expect(b.data.config.promptTemplate).not.toBe("mutated");
  });

  it("generates unique, readable ids", () => {
    const first = createFlowNode("action.aiPrompt", { x: 0, y: 0 });
    const second = createFlowNode("action.aiPrompt", { x: 0, y: 0 });

    expect(first.id).toBe("aiPrompt-1");
    expect(second.id).toBe("aiPrompt-2");
    expect(first.id).not.toBe(second.id);
  });

  it("defaults the manual trigger's sample payload to a parseable object", () => {
    const node = createFlowNode("trigger.manual", { x: 0, y: 0 });
    expect(() => JSON.parse(node.data.config.payloadJson)).not.toThrow();
  });
});

describe("config validation", () => {
  it("rejects invalid JSON in the manual trigger's sample payload", () => {
    const def = requireNodeDef("trigger.manual");
    const issues = def.validateConfig({ payloadJson: "{ not json" });

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("invalid-json");
    expect(issues[0].level).toBe("error");
    expect(issues[0].field).toBe("config.payloadJson");
  });

  it("accepts a valid payload, including an empty one", () => {
    const def = requireNodeDef("trigger.manual");
    expect(def.validateConfig({ payloadJson: '{"a":1}' })).toEqual([]);
    expect(def.validateConfig({ payloadJson: "" })).toEqual([]);
  });

  it("rejects a top-level array as a sample payload", () => {
    const def = requireNodeDef("trigger.manual");
    const issues = def.validateConfig({ payloadJson: "[1,2,3]" });
    expect(issues[0].code).toBe("invalid-json");
  });

  it("requires a prompt template on the AI node", () => {
    const def = requireNodeDef("action.aiPrompt");
    const issues = def.validateConfig({
      systemPrompt: "",
      promptTemplate: "   ",
      model: "ff-pro",
      temperature: 0.5,
    });

    expect(issues.map((issue) => issue.code)).toContain("missing-required-config");
  });

  it("rejects temperature outside 0..1", () => {
    const def = requireNodeDef("action.aiPrompt");
    const issues = def.validateConfig({
      systemPrompt: "",
      promptTemplate: "hi",
      model: "ff-pro",
      temperature: 1.4,
    });

    expect(issues.map((issue) => issue.code)).toContain("invalid-config");
  });

  it("accepts a fully-populated AI config", () => {
    const def = requireNodeDef("action.aiPrompt");
    expect(
      def.validateConfig({
        systemPrompt: "be brief",
        promptTemplate: "reply to {{user.name}}",
        model: "ff-mini",
        temperature: 0.2,
      }),
    ).toEqual([]);
  });
});
