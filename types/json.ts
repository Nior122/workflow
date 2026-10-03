/**
 * JSON primitives shared by the engine and the UI.
 *
 * Everything a node receives or produces is plain JSON so it can be serialised
 * to the run console, to localStorage, and into a share link without loss.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A node's input or output payload. Always an object at the top level. */
export type JsonObject = { [key: string]: JsonValue };

export type NodePayload = JsonObject;

/** Type guard: is this unknown value valid JSON we can store and render? */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (t === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

/**
 * Parse untrusted JSON (a user-typed sample payload, an imported workflow file).
 * Returns a discriminated result rather than throwing so callers must handle failure.
 */
export type ParseResult =
  | { ok: true; value: JsonObject }
  | { ok: false; error: string };

export function parseJsonObject(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Expected a JSON object at the top level" };
  }

  const value = parsed as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (!isJsonValue(entry)) {
      return { ok: false, error: `Field "${key}" is not valid JSON` };
    }
  }

  return { ok: true, value: value as JsonObject };
}

/** Pretty-print for the run console and inspector. */
export function formatJson(value: JsonValue, indent = 2): string {
  return JSON.stringify(value, null, indent);
}
