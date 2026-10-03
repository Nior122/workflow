import { beforeEach, describe, expect, it } from "vitest";
import {
  SHARE_HASH_PREFIX,
  buildShareUrl,
  decodeShareHash,
  encodeWorkflow,
  shareUrlLength,
} from "../share";
import { buildEdge, buildNode } from "@/lib/graph-builder";
import { resetNodeIdCounter } from "@/lib/engine/registry";

const base = {
  id: "wf-1",
  name: "My workflow",
  schemaVersion: 1 as const,
  createdAt: 1,
  updatedAt: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
};

beforeEach(resetNodeIdCounter);

describe("encodeWorkflow", () => {
  it("produces a URI-safe string with no characters that break a URL", () => {
    const encoded = encodeWorkflow({
      ...base,
      nodes: [buildNode("t1", "trigger.webhook")],
      edges: [],
    });

    expect(encoded).toMatch(/^[A-Za-z0-9\-_=.]+$/);
    expect(encoded.length).toBeGreaterThan(0);
  });

  it("compresses below raw JSON and stays under the URL soft limit", () => {
    const nodes = Array.from({ length: 12 }, (_, index) =>
      buildNode(`n${index}`, "action.aiPrompt", {
        promptTemplate: `Do thing number ${index}`,
        systemPrompt: "Be brief",
        model: "ff-mini",
        temperature: 0.4,
      }),
    );
    const encoded = encodeWorkflow({ ...base, nodes, edges: [] });
    const raw = JSON.stringify({ ...base, nodes, edges: [] });

    // lz-string's URI-safe alphabet costs ~1.3x, so the win is ~2x on JSON like this.
    expect(encoded.length).toBeLessThan(raw.length / 1.8);

    // The property that actually matters: a realistic workflow still fits a URL.
    const { tooLong } = buildShareUrl(
      { name: base.name, nodes, edges: [] },
      "https://flowforge.app",
    );
    expect(tooLong).toBe(false);
  });
});

describe("decodeShareHash", () => {
  it("round-trips a workflow exactly", () => {
    const workflow = {
      ...base,
      nodes: [
        buildNode("t1", "trigger.manual"),
        buildNode("a1", "action.transform", {
          mode: "map",
          fields: [{ id: "f1", key: "customer", value: "{{user.name}}" }],
        }),
        buildNode("o1", "output.email", {
          to: "a@b.c",
          subject: "Hi",
          body: "There",
        }),
      ],
      edges: [buildEdge("t1", "a1"), buildEdge("a1", "o1")],
    };

    const decoded = decodeShareHash(`${SHARE_HASH_PREFIX}${encodeWorkflow(workflow)}`);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.name).toBe("My workflow");
      expect(decoded.value.nodes).toHaveLength(3);
      expect(decoded.value.nodes[1].data.config).toEqual({
        mode: "map",
        fields: [{ id: "f1", key: "customer", value: "{{user.name}}" }],
      });
    }
  });

  it("rejects a hash that is not a share link", () => {
    expect(decodeShareHash("#section").ok).toBe(false);
    expect(decodeShareHash("").ok).toBe(false);
  });

  it("rejects corrupted base62 without throwing", () => {
    const result = decodeShareHash(`${SHARE_HASH_PREFIX}!!!not-valid!!!`);
    expect(result.ok).toBe(false);
  });

  it("rejects a payload that is not a workflow", () => {
    const junk = btoa(JSON.stringify({ hello: "world" })).replace(/=+$/, "");
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${junk}`).ok).toBe(false);
  });

  it("rejects a payload from a newer schema version", () => {
    const future = JSON.stringify({ ...base, schemaVersion: 999, nodes: [], edges: [] });
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${future}`).ok).toBe(false);
  });
});

describe("buildShareUrl", () => {
  it("returns an absolute url with the hash and no query string", () => {
    const { url, tooLong } = buildShareUrl(
      {
        name: "Demo",
        nodes: [buildNode("t1", "trigger.manual")],
        edges: [],
      },
      "https://flowforge.app",
    );

    expect(tooLong).toBe(false);
    expect(url.startsWith("https://flowforge.app#flow=")).toBe(true);
    expect(url).not.toContain("?");
  });

  it("flags workflows that exceed the soft URL limit", () => {
    const nodes = Array.from({ length: 400 }, (_, index) =>
      buildNode(`node-${index}`, "action.aiPrompt", {
        promptTemplate: "A sufficiently long prompt to inflate the payload ".repeat(3),
        systemPrompt: "Be brief",
        model: "ff-pro",
        temperature: 0.7,
      }),
    );

    const result = buildShareUrl({ name: "Big", nodes, edges: [] }, "https://flowforge.app");
    expect(result.tooLong).toBe(true);
  });

  it("reports a length that matches the generated url", () => {
    const nodes = [buildNode("t1", "trigger.manual")];
    const { url } = buildShareUrl({ name: "Demo", nodes, edges: [] }, "https://flowforge.app");

    expect(shareUrlLength({ name: "Demo", nodes, edges: [] }, "https://flowforge.app")).toBe(
      url.length,
    );
  });
});
