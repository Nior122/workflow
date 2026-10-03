import { beforeEach, describe, expect, it } from "vitest";
import { executeWorkflow, statusMapFromSteps } from "../executor";
import { edge, makeEffects, node, resetCounters } from "./helpers";
import type { EngineEvent, ExecutionSpeed, RunResult, StepLog } from "@/types/run";
import type { FlowEdge, FlowNode } from "@/types";

beforeEach(resetCounters);

const TRIGGER_PAYLOAD = JSON.stringify({
  user: { name: "Ada", email: "ada@example.com" },
  budget: 1200,
  source: "landing-page",
});

type Harness = {
  run: (options?: {
    speed?: ExecutionSpeed;
    random?: number;
    signal?: AbortSignal;
  }) => Promise<RunResult>;
  events: EngineEvent[];
  effects: ReturnType<typeof makeEffects>;
};

function harness(nodes: FlowNode[], edges: FlowEdge[]): Harness {
  const events: EngineEvent[] = [];
  const fake = makeEffects();

  return {
    events,
    effects: fake,
    run: (options = {}) =>
      executeWorkflow({
        runId: "run-1",
        workflowId: "wf-1",
        workflowName: "Test flow",
        nodes,
        edges,
        speed: options.speed ?? 1,
        effects: options.random === undefined ? fake.effects : makeEffects(options.random).effects,
        emit: (event) => events.push(event),
        signal: options.signal,
      }),
  };
}

const step = (result: RunResult, nodeId: string): StepLog | undefined =>
  result.steps.find((entry) => entry.nodeId === nodeId);

describe("linear execution", () => {
  const build = () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt", { promptTemplate: "Reply to {{user.name}}" }),
      node("o1", "output.log"),
    ];
    return harness(nodes, [edge("t1", "a1"), edge("a1", "o1")]);
  };

  it("completes and runs every node", async () => {
    const h = build();
    const result = await h.run();

    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(3);
    for (const id of ["t1", "a1", "o1"]) {
      expect(step(result, id)?.status).toBe("success");
    }
  });

  it("orders steps by start time", async () => {
    const result = await build().run();
    expect(result.steps.map((entry) => entry.nodeId)).toEqual(["t1", "a1", "o1"]);
  });

  it("passes the trigger payload downstream", async () => {
    const result = await build().run();
    expect(step(result, "a1")?.input).toEqual({
      user: { name: "Ada", email: "ada@example.com" },
      budget: 1200,
      source: "landing-page",
    });
  });

  it("resolves {{variables}} from the upstream payload", async () => {
    const result = await build().run();
    expect(step(result, "a1")?.meta?.prompt).toBe("Reply to Ada");
  });

  it("gives the AI node a simulated reply", async () => {
    const result = await build().run();
    const output = step(result, "a1")?.output;
    expect(typeof output?.text).toBe("string");
    expect((output?.text as string).length).toBeGreaterThan(0);
  });

  it("records a positive duration for every step", async () => {
    const result = await build().run();
    for (const entry of result.steps) {
      expect(entry.durationMs).toBeGreaterThan(0);
    }
  });

  it("reports the total run duration", async () => {
    const result = await build().run();
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.endedAt).not.toBeNull();
  });
});

describe("event stream", () => {
  it("emits start, per-node lifecycle events and end", async () => {
    const nodes = [node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }), node("o1", "output.log")];
    const h = harness(nodes, [edge("t1", "o1")]);
    await h.run();

    expect(h.events[0]).toMatchObject({ kind: "run:start", runId: "run-1" });
    expect(h.events.at(-1)).toMatchObject({ kind: "run:end", status: "completed" });

    const kinds = h.events.map((event) => event.kind);
    expect(kinds).toContain("node:running");
    expect(kinds).toContain("node:success");
    expect(kinds).toContain("edge:active");
  });

  it("emits run:start exactly once", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt"),
      node("o1", "output.log"),
    ];
    const h = harness(nodes, [edge("t1", "a1"), edge("a1", "o1")]);
    await h.run();

    expect(h.events.filter((event) => event.kind === "run:start")).toHaveLength(1);
  });

  it("emits one edge:active per traversed connection", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt"),
      node("o1", "output.log"),
    ];
    const edges = [edge("t1", "a1"), edge("a1", "o1")];
    const h = harness(nodes, edges);
    await h.run();

    expect(h.events.filter((event) => event.kind === "edge:active")).toHaveLength(2);
  });
});

describe("branching", () => {
  const build = (budget: number) => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify({ budget, lead: { name: "Ada" } }) }),
      node("c1", "action.condition", { left: "{{budget}}", operator: "gt", right: "500" }),
      node("yes", "output.log", { label: "big lead" }),
      node("no", "output.log", { label: "small lead" }),
    ];
    const edges = [
      edge("t1", "c1"),
      edge("c1", "yes", "true"),
      edge("c1", "no", "false"),
    ];
    return harness(nodes, edges);
  };

  it("runs only the true branch when the condition matches", async () => {
    const result = await build(1200).run();

    expect(step(result, "c1")?.meta?.matched).toBe(true);
    expect(step(result, "yes")?.status).toBe("success");
    expect(step(result, "no")?.status).toBe("skipped");
  });

  it("runs only the false branch when it does not match", async () => {
    const result = await build(100).run();

    expect(step(result, "c1")?.meta?.matched).toBe(false);
    expect(step(result, "no")?.status).toBe("success");
    expect(step(result, "yes")?.status).toBe("skipped");
  });

  it("still reports the run as completed when one branch is skipped", async () => {
    expect((await build(1200).run()).status).toBe("completed");
  });

  it("activates only the chosen branch's edge", async () => {
    const h = build(1200);
    await h.run();

    const active = h.events
      .filter((event) => event.kind === "edge:active")
      .map((event) => (event as { toNodeId: string }).toNodeId);

    expect(active).toContain("yes");
    expect(active).not.toContain("no");
  });
});

describe("merging", () => {
  const build = () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify({ a: 1 }) }),
      node("left", "action.textFormatter", { template: "left {{a}}" }),
      node("right", "action.textFormatter", { template: "right {{a}}" }),
      node("m1", "output.log"),
    ];
    const edges = [edge("t1", "left"), edge("t1", "right"), edge("left", "m1"), edge("right", "m1")];
    return harness(nodes, edges);
  };

  it("runs the merge node once, after both branches", async () => {
    const result = await build().run();

    expect(result.steps.filter((entry) => entry.nodeId === "m1")).toHaveLength(1);
    expect(step(result, "m1")?.status).toBe("success");
  });

  it("merges both upstream payloads into the merge input", async () => {
    const result = await build().run();
    const input = step(result, "m1")?.input;

    expect(input).toHaveProperty("text");
    expect(input).toHaveProperty("a", 1);
  });

  it("skips the merge when every upstream branch was skipped", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify({ budget: 10 }) }),
      node("c1", "action.condition", { left: "{{budget}}", operator: "gt", right: "500" }),
      node("mid", "action.textFormatter", { template: "x" }),
      node("m1", "output.log"),
    ];
    // Only the true branch reaches `mid`; the false branch dead-ends.
    const edges = [edge("t1", "c1"), edge("c1", "mid", "true"), edge("mid", "m1")];
    const result = await harness(nodes, edges).run();

    expect(step(result, "mid")?.status).toBe("skipped");
    expect(step(result, "m1")?.status).toBe("skipped");
  });
});

describe("failure handling", () => {
  it("fails the node, skips downstream, and marks the run failed", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt", { promptTemplate: "hi" }, { simulateFailure: true }),
      node("o1", "output.log"),
    ];
    const result = await harness(nodes, [edge("t1", "a1"), edge("a1", "o1")]).run();

    expect(step(result, "a1")?.status).toBe("error");
    expect(step(result, "a1")?.error?.code).toBe("simulated-failure");
    expect(step(result, "o1")?.status).toBe("skipped");
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("simulated-failure");
  });

  it("fails the whole run when a trigger's JSON is invalid", async () => {
    const nodes = [node("t1", "trigger.manual", { payloadJson: "{nope" })];
    const result = await harness(nodes, []).run();

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("validation-failed");
  });

  it("refuses to run a cyclic flow at all", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt", { promptTemplate: "hi" }),
      node("a2", "action.textFormatter", { template: "x" }),
    ];
    const edges = [edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a1")];
    const h = harness(nodes, edges);
    const result = await h.run();

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("cycle-detected");
    expect(result.steps).toHaveLength(0);
    expect(h.events.filter((event) => event.kind === "node:running")).toHaveLength(0);
  });
});

describe("execution speed", () => {
  const nodes = () => [
    node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }, { latencyMs: 600 }),
    node("o1", "output.log", undefined, { latencyMs: 600 }),
  ];

  it("halves the simulated latency at 2x", async () => {
    const normal = await harness(nodes(), [edge("t1", "o1")]).run({ speed: 1 });
    const fast = await harness(nodes(), [edge("t1", "o1")]).run({ speed: 2 });

    expect(fast.durationMs).toBeLessThan(normal.durationMs);
    expect(fast.durationMs).toBe(normal.durationMs / 2);
  });

  it("doubles the simulated latency at 0.5x", async () => {
    const normal = await harness(nodes(), [edge("t1", "o1")]).run({ speed: 1 });
    const slow = await harness(nodes(), [edge("t1", "o1")]).run({ speed: 0.5 });

    expect(slow.durationMs).toBe(normal.durationMs * 2);
  });

  it("records the speed on the result", async () => {
    expect((await harness(nodes(), [edge("t1", "o1")]).run({ speed: 2 })).speed).toBe(2);
  });
});

describe("cancellation", () => {
  it("stops and reports cancelled when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const nodes = [node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }), node("o1", "output.log")];
    const result = await harness(nodes, [edge("t1", "o1")]).run({ signal: controller.signal });

    expect(result.status).toBe("cancelled");
    expect(result.steps).toHaveLength(0);
  });
});

describe("node behaviours", () => {
  it("transform maps fields into a fresh payload", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify({ user: { name: "Ada" } }) }),
      node("x1", "action.transform", {
        mode: "map",
        fields: [{ id: "f1", key: "customer", value: "{{user.name}}" }],
      }),
    ];
    const result = await harness(nodes, [edge("t1", "x1")]).run();

    expect(step(result, "x1")?.output).toEqual({ customer: "Ada" });
  });

  it("transform merges over the input in merge mode", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify({ user: { name: "Ada" }, keep: 1 }) }),
      node("x1", "action.transform", {
        mode: "merge",
        fields: [{ id: "f1", key: "added", value: "yes" }],
      }),
    ];
    const result = await harness(nodes, [edge("t1", "x1")]).run();

    expect(step(result, "x1")?.output).toEqual({
      user: { name: "Ada" },
      keep: 1,
      added: "yes",
    });
  });

  it("http request returns a mock body plus a status", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: "{}" }),
      node("h1", "action.httpRequest", {
        method: "GET",
        url: "https://api.example.com/v1/invoices?status=overdue",
        headers: [],
        bodyJson: "",
      }),
    ];
    const result = await harness(nodes, [edge("t1", "h1")]).run();
    const output = step(result, "h1")?.output;

    expect(output?.status).toBe(200);
    expect(Array.isArray(output?.data)).toBe(true);
  });

  it("email composes a simulated delivery record", async () => {
    const nodes = [
      node("t1", "trigger.manual", {
        payloadJson: JSON.stringify({ lead: { name: "Ada", email: "ada@example.com" } }),
      }),
      node("e1", "output.email", {
        to: "{{lead.email}}",
        subject: "Hi {{lead.name}}",
        body: "Hello",
      }),
    ];
    const result = await harness(nodes, [edge("t1", "e1")]).run();
    const output = step(result, "e1")?.output;

    expect(output?.to).toBe("ada@example.com");
    expect(output?.subject).toBe("Hi Ada");
    expect(output?.delivered).toBe(true);
  });

  it("delay waits longer than a plain node", async () => {
    const withDelay = [
      node("t1", "trigger.manual", { payloadJson: "{}" }),
      node("d1", "action.delay", { seconds: 2 }),
    ];
    const withoutDelay = [
      node("t1", "trigger.manual", { payloadJson: "{}" }),
      node("l1", "output.log"),
    ];

    const slow = await harness(withDelay, [edge("t1", "d1")]).run();
    const fast = await harness(withoutDelay, [edge("t1", "l1")]).run();

    expect(slow.durationMs).toBeGreaterThan(fast.durationMs);
  });

  it("log output passes the payload through unchanged", async () => {
    const payload = { anything: "at all" };
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: JSON.stringify(payload) }),
      node("o1", "output.log"),
    ];
    const result = await harness(nodes, [edge("t1", "o1")]).run();

    expect(step(result, "o1")?.output).toEqual(payload);
  });
});

describe("statusMapFromSteps", () => {
  it("maps node ids to their final status", async () => {
    const nodes = [
      node("t1", "trigger.manual", { payloadJson: TRIGGER_PAYLOAD }),
      node("a1", "action.aiPrompt", { promptTemplate: "hi" }, { simulateFailure: true }),
    ];
    const result = await harness(nodes, [edge("t1", "a1")]).run();
    const map = statusMapFromSteps(result.steps);

    expect(map.get("t1")).toBe("success");
    expect(map.get("a1")).toBe("error");
  });
});
