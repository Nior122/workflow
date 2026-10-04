import { beforeEach, describe, expect, it } from "vitest";
import { CORE_TEMPLATES, TEMPLATES, TEMPLATE_TAGS, filterTemplates, getTemplate } from "../templates";
import { analyzeGraph } from "../engine/graph";
import { validateWorkflow } from "../engine/validator";
import { executeWorkflow } from "../engine/executor";
import { makeEffects, resetCounters } from "../engine/__tests__/helpers";

beforeEach(resetCounters);

describe("templates", () => {
  it("ships the eight core templates plus eight showcases with unique ids", () => {
    expect(CORE_TEMPLATES).toHaveLength(8);
    expect(TEMPLATES).toHaveLength(16);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  });

  it("tags every template and derives the filter chips from those tags", () => {
    for (const template of TEMPLATES) {
      expect(template.tags.length, `${template.id} has no tags`).toBeGreaterThan(0);
      for (const tag of template.tags) {
        expect(tag, `${template.id} tag "${tag}" must be lowercase`).toBe(tag.toLowerCase());
        expect(TEMPLATE_TAGS).toContain(tag);
      }
    }

    expect(TEMPLATE_TAGS).toEqual([...TEMPLATE_TAGS].sort((a, b) => a.localeCompare(b)));
    expect(new Set(TEMPLATE_TAGS).size).toBe(TEMPLATE_TAGS.length);
  });

  it("filters by tag and by free-text query", () => {
    const ai = filterTemplates(TEMPLATES, { tag: "ai" });
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.every((template) => template.tags.includes("ai"))).toBe(true);

    // "All" (null) and an empty tag both return the whole gallery.
    expect(filterTemplates(TEMPLATES, { tag: null })).toHaveLength(TEMPLATES.length);
    expect(filterTemplates(TEMPLATES, { tag: "" })).toHaveLength(TEMPLATES.length);

    const rag = filterTemplates(TEMPLATES, { query: "retrieval" });
    expect(rag.some((template) => template.id === "rag-knowledge-base")).toBe(true);

    // Query + tag compose instead of overriding each other.
    const composed = filterTemplates(TEMPLATES, { tag: "logic", query: "switch" });
    expect(composed).toHaveLength(1);
    expect(composed[0].id).toBe("order-fulfilment-switch");

    expect(filterTemplates(TEMPLATES, { query: "no-such-template" })).toHaveLength(0);
  });

  it("wires AI sub-nodes onto the agent's bottom ports in the showcase templates", () => {
    const graph = getTemplate("ai-support-agent")!.build();
    const subEdges = graph.edges.filter((edge) =>
      ["ai_model", "ai_memory", "ai_tool"].includes(String(edge.sourceHandle)),
    );

    expect(subEdges).toHaveLength(4);
    for (const edge of subEdges) {
      expect(edge.target).toBe("sa-agent");
      // Sub-node edges always pin both ends: the source's top port and the agent's
      // matching bottom port, plus the port kind the canvas colours by.
      expect(edge.targetHandle).toBe(edge.sourceHandle);
      expect(edge.data?.portKind).toBe(edge.sourceHandle);
    }
  });

  it("keeps every showcase template runnable without reaching a Stop and Error node", () => {
    for (const template of TEMPLATES) {
      const graph = template.build();
      expect(
        graph.nodes.some((node) => node.type === "logic.stopAndError"),
        `${template.id} would fail its own test run`,
      ).toBe(false);
    }
  });

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s declares the right node count and has non-empty nodes and edges",
    (_id, template) => {
      const graph = template.build();

      expect(graph.nodes).toHaveLength(template.nodeCount);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    },
  );

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s is a valid, acyclic graph with a single trigger",
    (_id, template) => {
      const graph = template.build();
      const result = validateWorkflow(graph.nodes, graph.edges);

      expect(result.issues).toEqual([]);
      expect(result.valid).toBe(true);
    },
  );

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s runs to completion with no errored nodes",
    async (_id, template) => {
      const graph = template.build();
      const analysis = analyzeGraph(graph.nodes, graph.edges);
      const { effects } = makeEffects();

      const result = await executeWorkflow({
        runId: "run-1",
        workflowId: "wf-1",
        workflowName: template.name,
        nodes: graph.nodes,
        edges: graph.edges,
        speed: 2,
        effects,
        emit: () => {},
      });

      expect(analysis.hasCycle).toBe(false);
      expect(result.status).toBe("completed");
      expect(result.steps.some((step) => step.status === "error")).toBe(false);
    },
  );

  it("builds independent graphs each time so edits do not leak between instances", () => {
    const template = getTemplate("lead-capture");
    expect(template).toBeDefined();

    const first = template!.build();
    const second = template!.build();

    expect(first.nodes).not.toBe(second.nodes);
    expect(first.nodes[0]).not.toBe(second.nodes[0]);
    expect(first.nodes[0].id).toBe(second.nodes[0].id);

    first.nodes[0].data.label = "mutated";
    expect(second.nodes[0].data.label).not.toBe("mutated");
  });

  it("uses deterministic edge ids so re-loading a template is idempotent", () => {
    const template = getTemplate("support-triage")!;
    const first = template.build();
    const second = template.build();

    expect(second.edges.map((edge) => edge.id)).toEqual(first.edges.map((edge) => edge.id));
  });

  it("emits a structured reasoning trace when running agent-powered templates", async () => {
    for (const id of ["incident-response", "deal-desk-research"]) {
      const template = getTemplate(id);
      expect(template, `missing template ${id}`).toBeDefined();

      const graph = template!.build();
      const { effects } = makeEffects();
      const result = await executeWorkflow({
        runId: `run-${id}`,
        workflowId: `wf-${id}`,
        workflowName: template!.name,
        nodes: graph.nodes,
        edges: graph.edges,
        speed: 2,
        effects,
        emit: () => {},
      });

      const agentSteps = result.steps.filter((entry) => entry.nodeType === "action.aiAgent");
      expect(agentSteps.length).toBeGreaterThan(0);
      expect(agentSteps[0].trace?.length).toBeGreaterThan(1);
    }
  });
});
