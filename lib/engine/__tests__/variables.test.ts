import { describe, expect, it } from "vitest";
import {
  extractTokens,
  renderTemplate,
  resolveOperand,
  resolvePath,
  resolveReference,
  type VariableScope,
} from "../variables";

const scope: VariableScope = {
  payload: {
    user: { name: "Ada", plan: "pro", tags: ["a", "b"] },
    budget: 1200,
    active: true,
    nothing: null,
  },
  nodes: {
    "ai-1": { text: "hello", ai: { model: "ff-pro" } },
  },
  run: { id: "run-1", workflowName: "Demo", startedAt: 1000, speed: 1 },
};

describe("resolvePath", () => {
  it("walks nested objects", () => {
    expect(resolvePath("user.name", scope.payload)).toBe("Ada");
    expect(resolvePath("user.plan", scope.payload)).toBe("pro");
  });

  it("walks array indices", () => {
    expect(resolvePath("user.tags.0", scope.payload)).toBe("a");
    expect(resolvePath("user.tags.1", scope.payload)).toBe("b");
  });

  it("returns undefined for missing keys rather than throwing", () => {
    expect(resolvePath("user.missing", scope.payload)).toBeUndefined();
    expect(resolvePath("nope.deep.path", scope.payload)).toBeUndefined();
  });

  it("returns undefined when walking through a null", () => {
    expect(resolvePath("nothing.x", scope.payload)).toBeUndefined();
  });

  it("returns the whole value for an empty path", () => {
    expect(resolvePath("", scope.payload)).toEqual(scope.payload);
  });

  it("does not treat a non-numeric segment as an array index", () => {
    expect(resolvePath("user.tags.first", scope.payload)).toBeUndefined();
  });
});

describe("resolveReference", () => {
  it("resolves bare dot-notation against the incoming payload", () => {
    expect(resolveReference("user.name", scope)).toBe("Ada");
    expect(resolveReference("budget", scope)).toBe(1200);
  });

  it("resolves $payload explicitly", () => {
    expect(resolveReference("$payload.user.name", scope)).toBe("Ada");
    expect(resolveReference("$payload", scope)).toEqual(scope.payload);
  });

  it("resolves $node.<id> to another node's output", () => {
    expect(resolveReference("$node.ai-1.text", scope)).toBe("hello");
    expect(resolveReference("$node.ai-1.ai.model", scope)).toBe("ff-pro");
    expect(resolveReference("$node.ai-1", scope)).toEqual({
      text: "hello",
      ai: { model: "ff-pro" },
    });
  });

  it("returns undefined for an unknown node id", () => {
    expect(resolveReference("$node.nope.text", scope)).toBeUndefined();
  });

  it("resolves $run metadata", () => {
    expect(resolveReference("$run.id", scope)).toBe("run-1");
    expect(resolveReference("$run.workflowName", scope)).toBe("Demo");
  });

  it("preserves booleans and numbers as typed values", () => {
    expect(resolveReference("active", scope)).toBe(true);
    expect(resolveReference("budget", scope)).toBe(1200);
  });
});

describe("renderTemplate", () => {
  it("interpolates multiple tokens", () => {
    const result = renderTemplate("{{user.name}} has {{budget}}", scope);
    expect(result.text).toBe("Ada has 1200");
    expect(result.unresolved).toEqual([]);
  });

  it("tolerates whitespace inside braces", () => {
    expect(renderTemplate("{{  user.name  }}", scope).text).toBe("Ada");
  });

  it("renders missing tokens as empty strings and reports them", () => {
    const result = renderTemplate("Hi {{user.name}}, ref {{user.referral}}", scope);
    expect(result.text).toBe("Hi Ada, ref ");
    expect(result.unresolved).toEqual(["user.referral"]);
  });

  it("de-duplicates repeated unresolved tokens", () => {
    const result = renderTemplate("{{a}} and {{a}}", scope);
    expect(result.unresolved).toEqual(["a"]);
  });

  it("renders null as empty, not the string \"null\"", () => {
    expect(renderTemplate("[{{nothing}}]", scope).text).toBe("[]");
  });

  it("JSON-stringifies objects and arrays", () => {
    expect(renderTemplate("{{user.tags}}", scope).text).toBe('["a","b"]');
  });

  it("leaves text with no tokens untouched", () => {
    expect(renderTemplate("plain text", scope).text).toBe("plain text");
  });

  it("does not recurse into a substituted value", () => {
    const nested: VariableScope = {
      ...scope,
      payload: { a: "{{b}}", b: "resolved" },
    };
    expect(renderTemplate("{{a}}", nested).text).toBe("{{b}}");
  });
});

describe("resolveOperand", () => {
  it("keeps a whole-string token typed", () => {
    expect(resolveOperand("{{budget}}", scope)).toBe(1200);
    expect(resolveOperand("{{active}}", scope)).toBe(true);
  });

  it("treats a plain literal as a string", () => {
    expect(resolveOperand("500", scope)).toBe("500");
  });

  it("renders a token embedded in text to a string", () => {
    expect(resolveOperand("cost {{budget}}", scope)).toBe("cost 1200");
  });

  it("returns an empty string for an unresolvable single token", () => {
    expect(resolveOperand("{{missing}}", scope)).toBe("");
  });
});

describe("extractTokens", () => {
  it("lists unique token bodies", () => {
    expect(extractTokens("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });

  it("trims whitespace", () => {
    expect(extractTokens("{{  user.name }}")).toEqual(["user.name"]);
  });

  it("returns nothing when there are no tokens", () => {
    expect(extractTokens("no tokens here")).toEqual([]);
  });
});
