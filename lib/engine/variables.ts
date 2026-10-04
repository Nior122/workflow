/**
 * Variable & Expression resolution.
 *
 * Supports:
 * - Legacy / bare dot-paths: `{{user.name}}`, `{{$payload.user.name}}`,
 *   `{{$node.nodeId.field}}`, `{{$run.id}}`
 * - n8n-style expressions:
 *   - `{{ $json.field }}` / `{{ $json }}`
 *   - `{{ $node["Node Name"].json.field }}` / `{{ $node['Node Name'].json.field }}`
 * - Built-in helpers:
 *   - `.toUpperCase()`, `.toLowerCase()`, `.trim()`, `.length`
 *   - `Math.round(...)`
 *   - `Date.now()`
 *
 * Unresolved tokens render as an empty string and are reported back so the console
 * can show what went missing rather than failing the run.
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
  /** The current node's merged input payload (`$json` / `$payload`). */
  payload: NodePayload;
  /** Output payload of every node that has already finished, keyed by node id. */
  nodes: Record<string, NodePayload>;
  /** Output payload of every node that has already finished, keyed by node label. */
  nodesByLabel?: Record<string, NodePayload>;
  run: RunScope;
  /** Optional deterministic clock for `Date.now()`. */
  now?: () => number;
};

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const NODE_BRACKET_PATTERN =
  /^\$node\[\s*(?:"([^"]+)"|'([^']+)')\s*\](?:\.json)?(?:\.(.*))?$/;
const MATH_ROUND_PATTERN = /^Math\.round\(\s*(.+?)\s*\)$/;

type HelperName = "toUpperCase" | "toLowerCase" | "trim" | "length";

/** Walk a dot path, supporting numeric array indices: "items.0.name". */
export function resolvePath(
  path: string,
  root: JsonValue | undefined,
): JsonValue | undefined {
  if (root === undefined) return undefined;
  if (path.length === 0) return root;

  let current: JsonValue | undefined = root;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      if (segment === "length") return current.length;
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }

    if (typeof current === "object") {
      if (segment in (current as Record<string, JsonValue>)) {
        current = (current as Record<string, JsonValue>)[segment];
        continue;
      }
      return undefined;
    }

    if (typeof current === "string" && segment === "length") {
      return current.length;
    }

    return undefined;
  }

  return current;
}

/** Peel trailing `.toUpperCase()`, `.toLowerCase()`, `.trim()` method calls. */
function peelTrailingHelpers(expr: string): {
  core: string;
  helpers: HelperName[];
} {
  let current = expr.trim();
  const helpers: HelperName[] = [];

  while (true) {
    if (current.endsWith(".toUpperCase()")) {
      helpers.unshift("toUpperCase");
      current = current.slice(0, -".toUpperCase()".length).trim();
      continue;
    }
    if (current.endsWith(".toLowerCase()")) {
      helpers.unshift("toLowerCase");
      current = current.slice(0, -".toLowerCase()".length).trim();
      continue;
    }
    if (current.endsWith(".trim()")) {
      helpers.unshift("trim");
      current = current.slice(0, -".trim()".length).trim();
      continue;
    }
    break;
  }

  return { core: current, helpers };
}

function applyHelpers(
  value: JsonValue | undefined,
  helpers: readonly HelperName[],
): JsonValue | undefined {
  let current = value;
  for (const helper of helpers) {
    if (current === undefined || current === null) return undefined;
    if (helper === "toUpperCase") {
      current = stringifyValue(current).toUpperCase();
    } else if (helper === "toLowerCase") {
      current = stringifyValue(current).toLowerCase();
    } else if (helper === "trim") {
      current = stringifyValue(current).trim();
    } else if (helper === "length") {
      if (typeof current === "string" || Array.isArray(current)) {
        current = current.length;
      } else {
        return undefined;
      }
    }
  }
  return current;
}

function resolveCoreReference(
  trimmed: string,
  scope: VariableScope,
): JsonValue | undefined {
  if (trimmed.length === 0) return undefined;

  if (trimmed === "Date.now()") {
    return scope.now ? scope.now() : Date.now();
  }

  const mathRound = trimmed.match(MATH_ROUND_PATTERN);
  if (mathRound) {
    const inner = mathRound[1].trim();
    const numericLiteral = Number(inner);
    if (!Number.isNaN(numericLiteral) && inner !== "") {
      return Math.round(numericLiteral);
    }
    const resolvedInner = resolveReference(inner, scope);
    const num = Number(resolvedInner);
    return Number.isFinite(num) ? Math.round(num) : undefined;
  }

  // n8n-style `$json` or `$json.field`
  if (trimmed === "$json" || trimmed.startsWith("$json.")) {
    return resolvePath(trimmed.slice("$json.".length).replace(/^\./, ""), scope.payload);
  }

  if (trimmed === "$payload" || trimmed.startsWith("$payload.")) {
    return resolvePath(trimmed.slice("$payload.".length).replace(/^\./, ""), scope.payload);
  }

  // n8n-style `$node["Node Name"].json.field` or `$node['Node Name'].json.field`
  const bracketMatch = trimmed.match(NODE_BRACKET_PATTERN);
  if (bracketMatch) {
    const nodeKey = (bracketMatch[1] ?? bracketMatch[2] ?? "").trim();
    const remainder = (bracketMatch[3] ?? "").trim();
    const nodePayload =
      scope.nodesByLabel?.[nodeKey] ?? scope.nodes[nodeKey];
    return remainder ? resolvePath(remainder, nodePayload) : nodePayload;
  }

  if (trimmed.startsWith("$node.")) {
    const rest = trimmed.slice("$node.".length);
    const dot = rest.indexOf(".");
    const nodeId = dot === -1 ? rest : rest.slice(0, dot);
    let remainder = dot === -1 ? "" : rest.slice(dot + 1);
    if (remainder === "json") remainder = "";
    else if (remainder.startsWith("json.")) remainder = remainder.slice("json.".length);
    const nodePayload = scope.nodes[nodeId] ?? scope.nodesByLabel?.[nodeId];
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

/** Resolve a single reference against the full scope. */
export function resolveReference(
  reference: string,
  scope: VariableScope,
): JsonValue | undefined {
  const { core, helpers } = peelTrailingHelpers(reference);
  const rawValue = resolveCoreReference(core, scope);
  return applyHelpers(rawValue, helpers);
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
