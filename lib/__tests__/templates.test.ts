import { beforeEach, describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate } from "../templates";
import { analyzeGraph } from "../engine/graph";
import { validateWorkflow } from "../engine/validator";
import { executeWorkflow } from "../engine/executor";
import { makeEffects, resetCounters } from "../engine/__tests__/helpers";

beforeEach(resetCounters);

describe("templates", () => {
  it("ships at least four templates with unique ids", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
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
});
