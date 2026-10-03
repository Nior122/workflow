import { describe, expect, it } from "vitest";
import { sameIssues, withValidation } from "../use-live-validation";

type Issue = { code: string; message: string };
type FakeNode = { id: string; data: { label: string; validation?: Issue[] } };

const ISSUE: Issue = { code: "no_trigger", message: "The flow needs a trigger node." };

/**
 * Reproduces one pass of the debounced diff/write cycle in `useLiveValidation`,
 * so the convergence property can be asserted directly instead of by clicking
 * around a browser.
 */
function onePass(nodes: FakeNode[], grouped: Map<string, Issue[]>) {
  const changed = nodes
    .map((node) => {
      const issues = grouped.get(node.id) ?? [];
      if (sameIssues(node.data.validation ?? [], issues)) return null;
      return { id: node.id, issues };
    })
    .filter((entry) => entry !== null) as { id: string; issues: Issue[] }[];

  if (changed.length === 0) return { nodes, writes: 0 };

  return {
    writes: changed.length,
    nodes: nodes.map((node) => {
      const entry = changed.find((item) => item.id === node.id);
      return entry ? withValidation(node, entry.issues) : node;
    }),
  };
}

describe("withValidation", () => {
  it("attaches issues when there are some", () => {
    const node: FakeNode = { id: "n1", data: { label: "AI Prompt" } };
    const next = withValidation(node, [ISSUE]);

    expect(next.data.validation).toEqual([ISSUE]);
    expect(next.data.label).toBe("AI Prompt");
  });

  it("removes the key entirely when there are none", () => {
    const node: FakeNode = { id: "n1", data: { label: "AI Prompt", validation: [ISSUE] } };
    const next = withValidation(node, []);

    // Not merely an empty array — the key must be gone, or the next diff sees a
    // difference that is not there.
    expect("validation" in next.data).toBe(false);
  });

  it("does not mutate the input node", () => {
    const node: FakeNode = { id: "n1", data: { label: "AI Prompt", validation: [ISSUE] } };
    withValidation(node, []);

    expect(node.data.validation).toEqual([ISSUE]);
  });
});

describe("validation diff convergence", () => {
  it("clears a resolved error and then stops writing", () => {
    // The node still carries the error from the pass where it was detected…
    let nodes: FakeNode[] = [{ id: "n1", data: { label: "AI Prompt", validation: [ISSUE] } }];

    // …but the user has fixed the graph, so the validator now reports nothing.
    const resolved = new Map<string, Issue[]>();

    const first = onePass(nodes, resolved);
    expect(first.writes).toBe(1);
    nodes = first.nodes;

    expect("validation" in nodes[0].data).toBe(false);

    // The regression: before the fix this returned writes: 1 forever, re-rendering
    // the canvas every debounce tick and leaving the badge stuck on the node.
    const second = onePass(nodes, resolved);
    expect(second.writes).toBe(0);
  });

  it("stops writing when nothing has ever been wrong", () => {
    const nodes: FakeNode[] = [{ id: "n1", data: { label: "Manual" } }];
    expect(onePass(nodes, new Map()).writes).toBe(0);
  });

  it("writes once when an error appears, then settles", () => {
    let nodes: FakeNode[] = [{ id: "n1", data: { label: "Manual" } }];
    const broken = new Map<string, Issue[]>([["n1", [ISSUE]]]);

    expect(onePass(nodes, broken).writes).toBe(1);
    nodes = onePass(nodes, broken).nodes;
    expect(nodes[0].data.validation).toEqual([ISSUE]);

    expect(onePass(nodes, broken).writes).toBe(0);
  });

  it("treats a changed message as a real change but a reworded duplicate as not", () => {
    expect(sameIssues([ISSUE], [{ ...ISSUE, message: "Different" }])).toBe(false);
    expect(sameIssues([ISSUE], [{ ...ISSUE }])).toBe(true);
    expect(sameIssues([], [])).toBe(true);
    expect(sameIssues([ISSUE], [])).toBe(false);
  });

  it("only touches the nodes whose issues actually changed", () => {
    const nodes: FakeNode[] = [
      { id: "n1", data: { label: "Manual" } },
      { id: "n2", data: { label: "AI Prompt" } },
    ];

    const result = onePass(nodes, new Map([["n2", [ISSUE]]]));

    expect(result.writes).toBe(1);
    expect(result.nodes[0]).toBe(nodes[0]); // untouched, same reference
    expect(result.nodes[1].data.validation).toEqual([ISSUE]);
  });
});
