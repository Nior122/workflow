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
import { NODE_CATEGORY, type NodeType } from "@/types/nodes";

describe("node registry", () => {
  it("exposes all fourteen node types, grouped triggers → actions → outputs", () => {
    expect(listNodeDefs().map((def) => def.type)).toEqual([
      "trigger.manual",
      "trigger.webhook",
      "trigger.schedule",
      "action.aiPrompt",
      "action.aiAgent",
      "action.httpRequest",
      "action.transform",
      "action.condition",
      "action.delay",
      "action.textFormatter",
      "output.email",
      "output.slack",
      "output.sheets",
      "output.log",
    ]);
  });

  it("covers every member of the NodeType union exactly once", () => {
    const types = listNodeDefs().map((def) => def.type);
    expect(new Set(types).size).toBe(types.length);
    // Every NodeType in types/nodes.ts must appear in NODE_CATEGORY, which is
    // exhaustive over the union — so its keys are the full set.
    expect([...types].sort()).toEqual(Object.keys(NODE_CATEGORY).sort());
  });

  it("reports a genuinely unknown node type as unavailable rather than half-present", () => {
    const unknown = "action.doesNotExist" as NodeType;
    expect(isNodeTypeImplemented(unknown)).toBe(false);
    expect(getNodeDef(unknown)).toBeUndefined();
  });

  it("throws when an unknown type is demanded", () => {
    expect(() => requireNodeDef("action.doesNotExist" as NodeType)).toThrow(
      /No node definition/,
    );
  });

  it.each([
    ["trigger.manual", 0, 1],
    ["trigger.webhook", 0, 1],
    ["trigger.schedule", 0, 1],
    ["action.aiPrompt", 1, 1],
    ["action.aiAgent", 1, 1],
    ["action.httpRequest", 1, 1],
    ["action.transform", 1, 1],
    ["action.condition", 1, 2],
    ["action.delay", 1, 1],
    ["action.textFormatter", 1, 1],
    ["output.email", 1, 0],
    ["output.slack", 1, 0],
    ["output.sheets", 1, 0],
    ["output.log", 1, 0],
  ] as [NodeType, number, number][])(
    "%s exposes %i input(s) and %i output(s)",
    (type, inputCount, outputCount) => {
      const def = requireNodeDef(type);
      expect(def.inputs).toHaveLength(inputCount);
      expect(def.outputs).toHaveLength(outputCount);
      expect(def.category).toBe(NODE_CATEGORY[type]);
    },
  );

  it("gives the condition node true/false output handles, not a generic one", () => {
    const def = requireNodeDef("action.condition");
    expect(def.outputs.map((port) => port.id)).toEqual(["true", "false"]);
  });

  it("never gives a trigger an input handle", () => {
    for (const def of listNodeDefs().filter((entry) => entry.category === "trigger")) {
      expect(def.inputs).toHaveLength(0);
    }
  });

  it("never gives an output node an output handle", () => {
    for (const def of listNodeDefs().filter((entry) => entry.category === "output")) {
      expect(def.outputs).toHaveLength(0);
    }
  });

  it("ships a default config that passes its own validation", () => {
    for (const def of listNodeDefs()) {
      const issues = def.validateConfig(def.defaultConfig);
      expect(issues, `${def.type} default config is invalid`).toEqual([]);
    }
  });

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

  it("requires a goal on the AI Agent node", () => {
    const def = requireNodeDef("action.aiAgent");
    const issues = def.validateConfig({
      systemPrompt: "",
      goal: "   ",
      model: "ff-pro",
      tools: ["kbLookup"],
      maxSteps: 3,
    });

    expect(issues.map((issue) => issue.code)).toContain("missing-required-config");
  });

  it("rejects maxSteps outside 1..6 on the AI Agent node", () => {
    const def = requireNodeDef("action.aiAgent");
    const low = def.validateConfig({
      systemPrompt: "",
      goal: "triage {{user.name}}",
      model: "ff-pro",
      tools: [],
      maxSteps: 0,
    });
    const high = def.validateConfig({
      systemPrompt: "",
      goal: "triage {{user.name}}",
      model: "ff-pro",
      tools: [],
      maxSteps: 7,
    });

    expect(low.map((issue) => issue.code)).toContain("invalid-config");
    expect(high.map((issue) => issue.code)).toContain("invalid-config");
  });

  it("rejects unbalanced {{ }} tokens in the AI Agent goal or system prompt", () => {
    const def = requireNodeDef("action.aiAgent");
    const issues = def.validateConfig({
      systemPrompt: "Role for {{org",
      goal: "Investigate {{user.name",
      model: "ff-pro",
      tools: ["calculator"],
      maxSteps: 2,
    });

    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.code === "invalid-config")).toBe(true);
  });
});
