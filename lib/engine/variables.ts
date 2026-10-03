/**
 * Variable resolution.
 *
 * `{{user.name}}` resolves against the current node's input payload first — the
 * behaviour the spec asks for — then falls back to the reserved roots `$payload`,
 * `$node.<nodeId>` and `$run`. Unresolved tokens render as an empty string and are
 * reported back so the console can show what went missing rather than failing the run.
 *
 * Pure module: no React, no DOM.
 */

import type { JsonValue, NodePayload } from "@/types/json";

export type RunScope = {
  id: string;
  workflowName: string;
  startedAt: number;
  speed: number;
};

export type VariableScope = {
  /** The current node's merged input payload. */
  payload: NodePayload;
  /** Output payload of every node that has already finished, keyed by node id. */
  nodes: Record<string, NodePayload>;
  run: RunScope;
};

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Walk a dot path, supporting numeric array indices: "items.0.name". */
export function resolvePath(
  path: string,
  root: JsonValue | undefined,
): JsonValue | undefined {
  if (root === undefined) return undefined;
  // "".split(".") is [""], which would look up a literal empty key. An empty path
  // means "the root itself" — that is what {{ $payload }} and {{ $node.x }} resolve to.
  if (path.length === 0) return root;

  let current: JsonValue | undefined = root;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }

    if (typeof current === "object") {
      current = (current as Record<string, JsonValue>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

/** Resolve a single reference against the full scope. */
export function resolveReference(
  reference: string,
  scope: VariableScope,
): JsonValue | undefined {
  const trimmed = reference.trim();
  if (trimmed.length === 0) return undefined;

  if (trimmed === "$payload" || trimmed.startsWith("$payload.")) {
    return resolvePath(trimmed.slice("$payload.".length).replace(/^\./, ""), scope.payload);
  }

  if (trimmed.startsWith("$node.")) {
    const rest = trimmed.slice("$node.".length);
    const dot = rest.indexOf(".");
    const nodeId = dot === -1 ? rest : rest.slice(0, dot);
    const remainder = dot === -1 ? "" : rest.slice(dot + 1);
    const nodePayload = scope.nodes[nodeId];
    return remainder ? resolvePath(remainder, nodePayload) : nodePayload;
  }

  if (trimmed === "$run" || trimmed.startsWith("$run.")) {
    const runValue: NodePayload = {
      id: scope.run.id,
      workflowName: scope.run.workflowName,
      startedAt: scope.run.startedAt,
      speed: scope.run.speed,
    };
    return resolvePath(trimmed.slice("$run.".length).replace(/^\./, ""), runValue);
  }

  // Bare dot-notation resolves against the incoming payload.
  return resolvePath(trimmed, scope.payload);
}

/** Stringify a JSON value the way a template should render it. */
export function stringifyValue(value: JsonValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export type RenderResult = {
  text: string;
  /** Token bodies that resolved to nothing, for display in the run console. */
  unresolved: string[];
};

/** Interpolate every {{token}} in a template. */
export function renderTemplate(template: string, scope: VariableScope): RenderResult {
  const unresolved: string[] = [];

  const text = template.replace(TOKEN_PATTERN, (_match, reference: string) => {
    const value = resolveReference(reference, scope);
    if (value === undefined || value === null) {
      unresolved.push(reference.trim());
      return "";
    }
    return stringifyValue(value);
  });

  return { text, unresolved: [...new Set(unresolved)] };
}

/**
 * Resolve a value that may be a literal or a single {{token}} reference.
 *
 * Used by condition operands, where "500" must stay a number rather than become
 * the string "500". A whole-string token returns the typed value; anything else
 * is treated as a literal.
 */
export function resolveOperand(raw: string, scope: VariableScope): JsonValue {
  const trimmed = raw.trim();
  const singleToken = trimmed.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);

  if (singleToken) {
    const value = resolveReference(singleToken[1], scope);
    return value === undefined ? "" : value;
  }

  // A template with surrounding text renders to a string.
  if (TOKEN_PATTERN.test(trimmed)) {
    TOKEN_PATTERN.lastIndex = 0;
    return renderTemplate(trimmed, scope).text;
  }
  TOKEN_PATTERN.lastIndex = 0;

  return trimmed;
}

/** Every token body referenced in a template, for the inspector's chip list. */
export function extractTokens(template: string): string[] {
  const tokens: string[] = [];
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    tokens.push(match[1].trim());
  }
  return [...new Set(tokens)];
}
