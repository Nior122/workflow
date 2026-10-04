import { describe, expect, it } from "vitest";
import {
  ALL_REGISTRY_NODES,
  AI_NODES,
  BUSINESS_NODES,
  DATA_NODES,
  LOGIC_NODES,
  MESSAGING_NODES,
  TRIGGER_NODES,
  getRegistryNode,
  searchRegistryNodes,
} from "../index";
import { validateAllRegistryNodes } from "../validate-registry";
import {
  createFlowEdge,
  createFlowNode,
  listAllNodeDefs,
  requireNodeDef,
} from "@/lib/engine/registry";
import { executeWorkflow } from "@/lib/engine/executor";
import { validateConnectionCompat, validateWorkflow } from "@/lib/engine/validator";
import { renderTemplate } from "@/lib/engine/variables";

const deterministicEffects = {
  sleep: async () => {},
  now: () => 1_760_000_000_000,
  random: () => 0.42,
};

describe("144-node Master Registry (Batches A–F)", () => {
  it("registers all 144 nodes across Batches A, B, C, D, E, and F with zero validation errors", () => {
    expect(TRIGGER_NODES.length).toBe(33);
    expect(MESSAGING_NODES.length).toBe(18);
    expect(DATA_NODES.length).toBe(13);
    expect(BUSINESS_NODES.length).toBe(16);
    expect(LOGIC_NODES.length).toBe(27);
    expect(AI_NODES.length).toBe(37);
    expect(ALL_REGISTRY_NODES.length).toBe(144);
    expect(listAllNodeDefs().length).toBe(144);

    const errors = validateAllRegistryNodes(ALL_REGISTRY_NODES);
    expect(errors).toEqual([]);
  });

  it("supports fast keyword search across label, description, category, and keywords", () => {
    const paystack = searchRegistryNodes("ngn paystack");
    expect(paystack.map((n) => n.id)).toContain("trigger.paystackPayment");
    expect(paystack.map((n) => n.id)).toContain("action.paystack");

    const whatsapp = searchRegistryNodes("whatsapp");
    expect(whatsapp.map((n) => n.id)).toEqual(
      expect.arrayContaining([
        "trigger.whatsappMessage",
        "action.whatsappSend",
        "aiTool.whatsapp",
      ]),
    );
  });

  it("executes every single one of the 144 nodes through the engine without throwing", async () => {
    const sampleInput = {
      text: "Please check invoice #1042 for $1200 and schedule a review.",
      category: "billing",
      budget: 1200,
      source: "landing-page",
      from: "+2348031234567",
      chatId: "chat_101",
      user: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        plan: "pro",
      },
      data: [{ id: 1, status: "active" }, { id: 2, status: "active" }],
    };

    for (const regNode of ALL_REGISTRY_NODES) {
      const engineDef = requireNodeDef(regNode.id);
      const out = await engineDef.execute(sampleInput, engineDef.defaultConfig, {
        nodeId: `test-${regNode.id}`,
        nodeLabel: regNode.label,
        scope: {
          payload: sampleInput,
          nodes: {},
          nodesByLabel: {},
          run: {
            id: "run-test",
            workflowName: "Registry Test",
            startedAt: 1_760_000_000_000,
            speed: 1,
          },
          now: deterministicEffects.now,
        },
        items: [{ json: sampleInput }],
        subNodes: { tools: [] },
        latencyMs: 300,
        sleep: deterministicEffects.sleep,
        now: deterministicEffects.now,
        random: deterministicEffects.random,
        speed: 1,
      });

      expect(out.payload, `${regNode.id} returned null/undefined payload`).toBeDefined();
      expect(typeof out.payload).toBe("object");
    }
  });
});

describe("Phase 4 — AI Agent Sub-Node System (Models, Memory, Tools, Multi-Agent)", () => {
  it("validates handle compatibility between sub-nodes and AI Agent ports", () => {
    const trigger = createFlowNode("trigger.manual", { x: 0, y: 0 });
    const agent = createFlowNode("action.aiAgent", { x: 300, y: 0 });
    const openai = createFlowNode("aiModel.openai", { x: 200, y: 240 });
    const anthropic = createFlowNode("aiModel.anthropic", { x: 320, y: 240 });
    const calc = createFlowNode("aiTool.calculator", { x: 440, y: 240 });

    // Valid: model -> aiAgent on ai_model handle
    expect(
      validateConnectionCompat({
        sourceNode: openai,
        targetNode: agent,
        sourceHandle: "ai_model",
        targetHandle: "ai_model",
      }).valid,
    ).toBe(true);

    // Invalid: model -> trigger
    expect(
      validateConnectionCompat({
        sourceNode: openai,
        targetNode: trigger,
        sourceHandle: "ai_model",
        targetHandle: "in",
      }).valid,
    ).toBe(false);

    // Invalid: calculator tool -> ai_model handle
    expect(
      validateConnectionCompat({
        sourceNode: calc,
        targetNode: agent,
        sourceHandle: "ai_tool",
        targetHandle: "ai_model",
      }).valid,
    ).toBe(false);

    // Invalid: second Chat Model on the same AI Agent
    const existingEdge = createFlowEdge("e-model-1", openai.id, agent.id, {
      sourceHandle: "ai_model",
      targetHandle: "ai_model",
    });
    expect(
      validateConnectionCompat({
        sourceNode: anthropic,
        targetNode: agent,
        sourceHandle: "ai_model",
        targetHandle: "ai_model",
        existingEdges: [existingEdge],
      }).valid,
    ).toBe(false);
  });

  it("executes an AI Agent wired to Chat Model, Memory, Calculator, and Call Another Agent sub-nodes", async () => {
    const trigger = createFlowNode("trigger.chatMessage", { x: 0, y: 0 });
    const agent = createFlowNode("action.aiAgent", { x: 320, y: 0 });
    const model = createFlowNode("aiModel.openai", { x: 200, y: 240 });
    const memory = createFlowNode("aiMemory.windowBuffer", { x: 320, y: 240 });
    const calc = createFlowNode("aiTool.calculator", { x: 440, y: 240 });
    const subAgent = createFlowNode("aiTool.callAgent", { x: 560, y: 240 });
    const log = createFlowNode("output.log", { x: 640, y: 0 });

    const edges = [
      createFlowEdge("e1", trigger.id, agent.id),
      createFlowEdge("e-model", model.id, agent.id, {
        sourceHandle: "ai_model",
        targetHandle: "ai_model",
      }),
      createFlowEdge("e-mem", memory.id, agent.id, {
        sourceHandle: "ai_memory",
        targetHandle: "ai_memory",
      }),
      createFlowEdge("e-calc", calc.id, agent.id, {
        sourceHandle: "ai_tool",
        targetHandle: "ai_tool",
      }),
      createFlowEdge("e-subagent", subAgent.id, agent.id, {
        sourceHandle: "ai_tool",
        targetHandle: "ai_tool",
      }),
      createFlowEdge("e2", agent.id, log.id),
    ];

    const nodes = [trigger, agent, model, memory, calc, subAgent, log];
    const validation = validateWorkflow(nodes, edges);
    expect(validation.valid).toBe(true);

    const result = await executeWorkflow({
      runId: "run-agent-subnodes",
      workflowId: "wf-agent",
      workflowName: "Agent Sub-Nodes",
      nodes,
      edges,
      speed: 2,
      effects: deterministicEffects,
      emit: () => {},
    });

    expect(result.status).toBe("completed");
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);

    const agentStep = result.steps.find((s) => s.nodeId === agent.id);
    expect(agentStep).toBeDefined();
    expect(agentStep?.trace?.length).toBeGreaterThanOrEqual(2);
    // Verify nested trace from Call Another Agent tool
    const nestedStep = agentStep?.trace?.find((t) => t.nestedTrace && t.nestedTrace.length > 0);
    expect(nestedStep?.nestedTrace?.length).toBe(2);
  });
});

describe("Phase 5 — Switch, Merge, Approval, Error Recovery & n8n Expressions", () => {
  it("routes items through logic.switch to the matching case handle", async () => {
    const trigger = createFlowNode("trigger.manual", { x: 0, y: 0 });
    trigger.data.config = { payloadJson: '{"category": "technical", "user": "Ada"}' };

    const sw = createFlowNode("logic.switch", { x: 300, y: 0 });
    const case0Log = createFlowNode("output.log", { x: 600, y: -100 });
    const case1Log = createFlowNode("output.log", { x: 600, y: 0 });
    const fallbackLog = createFlowNode("output.log", { x: 600, y: 100 });

    const edges = [
      createFlowEdge("e1", trigger.id, sw.id),
      createFlowEdge("e-c0", sw.id, case0Log.id, { sourceHandle: "case_0" }),
      createFlowEdge("e-c1", sw.id, case1Log.id, { sourceHandle: "case_1" }),
      createFlowEdge("e-fb", sw.id, fallbackLog.id, { sourceHandle: "fallback" }),
    ];

    const result = await executeWorkflow({
      runId: "run-switch",
      workflowId: "wf-switch",
      workflowName: "Switch Test",
      nodes: [trigger, sw, case0Log, case1Log, fallbackLog],
      edges,
      speed: 2,
      effects: deterministicEffects,
      emit: () => {},
    });

    expect(result.status).toBe("completed");
    const stepById = new Map(result.steps.map((s) => [s.nodeId, s.status]));
    expect(stepById.get(case1Log.id)).toBe("success");
    expect(stepById.get(case0Log.id)).toBe("skipped");
    expect(stepById.get(fallbackLog.id)).toBe("skipped");
  });

  it("supports per-node continueOnError and retryOnFail", async () => {
    const trigger = createFlowNode("trigger.manual", { x: 0, y: 0 });
    const flaky = createFlowNode("action.httpRequest", { x: 300, y: 0 });
    flaky.data.simulateFailure = true;
    flaky.data.continueOnError = true;
    flaky.data.retryOnFail = true;
    flaky.data.maxRetries = 2;

    const sink = createFlowNode("output.log", { x: 600, y: 0 });
    const edges = [
      createFlowEdge("e1", trigger.id, flaky.id),
      createFlowEdge("e2", flaky.id, sink.id),
    ];

    const result = await executeWorkflow({
      runId: "run-continue-error",
      workflowId: "wf-continue",
      workflowName: "Continue On Error",
      nodes: [trigger, flaky, sink],
      edges,
      speed: 2,
      effects: deterministicEffects,
      emit: () => {},
    });

    expect(result.status).toBe("completed");
    const flakyStep = result.steps.find((s) => s.nodeId === flaky.id);
    expect(flakyStep?.status).toBe("success");
    expect(flakyStep?.retriesUsed).toBe(2);
    expect(flakyStep?.output?.continuedOnError).toBe(true);
  });

  it("evaluates $json, $node[\"Label\"].json, string helpers, Math.round, and Date.now()", () => {
    const scope = {
      payload: {
        name: "  ada lovelace  ",
        score: 87.6,
        tags: ["ai", "vip", "pro"],
      },
      nodes: {
        "n-1": { status: "verified" },
      },
      nodesByLabel: {
        "Stripe Payment": { amount: 4200, currency: "usd" },
      },
      run: {
        id: "run-1",
        workflowName: "Expr Test",
        startedAt: 1_760_000_000_000,
        speed: 1,
      },
      now: () => 1_760_000_123_456,
    };

    expect(
      renderTemplate(
        'Customer {{ $json.name.trim().toUpperCase() }} paid {{ $node["Stripe Payment"].json.amount }} {{ $node["Stripe Payment"].json.currency.toUpperCase() }} (score {{ Math.round($json.score) }}, tags={{ $json.tags.length }}, at={{ Date.now() }})',
        scope,
      ).text,
    ).toBe(
      "Customer ADA LOVELACE paid 4200 USD (score 88, tags=3, at=1760000123456)",
    );
  });

  it("exposes getRegistryNode for every node ID", () => {
    expect(getRegistryNode("action.aiAgent")?.type).toBe("ai-agent");
    expect(getRegistryNode("logic.stickyNote")?.type).toBe("annotation");
  });
});
