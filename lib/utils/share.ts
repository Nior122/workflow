import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { WORKFLOW_SCHEMA_VERSION } from "@/types/workflow";
import type { FlowEdge, FlowNode } from "@/types";

/**
 * Share links encode the workflow in the URL hash.
 *
 * lz-string is used rather than plain base64 because a 20-node flow as raw JSON
 * is comfortably past the length many tools will truncate. `EncodedURIComponent`
 * keeps the output URL-safe with no extra escaping.
 */

export type SharedWorkflow = {
  v: number;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const SHARE_HASH_PREFIX = "#flow=";

/** Roughly where links start getting truncated by chat apps and some browsers. */
export const SHARE_URL_SOFT_LIMIT = 2000;

export function encodeWorkflow(input: {
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}): string {
  const payload: SharedWorkflow = {
    v: WORKFLOW_SCHEMA_VERSION,
    name: input.name,
    nodes: input.nodes,
    edges: input.edges,
  };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export type DecodeResult =
  | { ok: true; value: { name: string; nodes: FlowNode[]; edges: FlowEdge[] } }
  | { ok: false; error: string };

/**
 * Decode a share hash.
 *
 * Returns a discriminated result rather than throwing, because the input is
 * entirely user-controlled — a truncated or hand-edited link must produce a
 * readable message, not a crash.
 */
export function decodeShareHash(hash: string): DecodeResult {
  const raw = hash.startsWith(SHARE_HASH_PREFIX)
    ? hash.slice(SHARE_HASH_PREFIX.length)
    : hash.replace(/^#/, "");

  if (raw.length === 0) {
    return { ok: false, error: "That link has no workflow in it." };
  }

  let decompressed: string | null;
  try {
    decompressed = decompressFromEncodedURIComponent(raw);
  } catch {
    return { ok: false, error: "That link could not be decoded." };
  }

  if (!decompressed) {
    return { ok: false, error: "That link is empty or was truncated." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decompressed);
  } catch {
    return { ok: false, error: "That link does not contain a valid workflow." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "That link does not contain a valid workflow." };
  }

  const candidate = parsed as Partial<SharedWorkflow>;

  if (typeof candidate.v !== "number") {
    return { ok: false, error: "That link is missing a schema version." };
  }
  if (candidate.v > WORKFLOW_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That link was made by a newer version of FlowForge (schema v${candidate.v}).`,
    };
  }
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return { ok: false, error: "That link is missing its nodes or connections." };
  }

  return {
    ok: true,
    value: {
      name: typeof candidate.name === "string" && candidate.name ? candidate.name : "Shared workflow",
      nodes: candidate.nodes as FlowNode[],
      edges: candidate.edges as FlowEdge[],
    },
  };
}

/**
 * Build the full share URL.
 *
 * `base` is injectable so this stays unit-testable outside a browser; it defaults
 * to the current page.
 */
export function buildShareUrl(
  input: { name: string; nodes: FlowNode[]; edges: FlowEdge[] },
  base?: string,
): { url: string; tooLong: boolean } {
  const prefix = base ?? (typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`);
  const encoded = encodeWorkflow(input);
  const url = `${prefix}${SHARE_HASH_PREFIX}${encoded}`;
  return { url, tooLong: url.length > SHARE_URL_SOFT_LIMIT };
}

/** Full share-link length, so the UI can warn before the user pastes it somewhere. */
export function shareUrlLength(
  input: { name: string; nodes: FlowNode[]; edges: FlowEdge[] },
  base?: string,
): number {
  const prefix = base ?? (typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`);
  return encodeWorkflow(input).length + SHARE_HASH_PREFIX.length + prefix.length;
}


/**
 * The URL to leave in the address bar once a share link has been consumed.
 *
 * The `#flow=` hash has to go: `usePersistence` checks for it on every mount and
 * returns before reading localStorage, so leaving it in place means a reload
 * re-adopts the shared graph forever and the visitor's own workflow becomes
 * unreachable. Stripping only the fragment keeps the path and query intact.
 *
 * Pure so the stripping is unit-tested rather than eyeballed.
 */
export function withoutShareHash(url: string): string {
  const hashIndex = url.indexOf("#");
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}
