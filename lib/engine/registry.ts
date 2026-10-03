/**
 * Pure node-type metadata.
 *
 * RULE: nothing in `lib/engine/**` may import React, @xyflow/react, or Zustand.
 * This module is the contract between the execution engine and the UI — it owns
 * ports, default configs, latency and config validation. Icons, accent colours and
 * config form components live in `components/nodes/registry.tsx`, keyed by the same
 * NodeType.
 *
 * The per-type definitions live in `./node-defs/` grouped by category.
 */

import { LATENCY_MAX_MS, LATENCY_MIN_MS, NODE_WIDTH } from "@/config/constants";
import {
  NODE_CATEGORY,
  type FlowNodeOf,
  type NodeCategory,
  type NodeConfig,
  type NodeConfigOf,
  type NodeType,
} from "@/types/nodes";
import { createFlowEdge, type SourceHandleId } from "@/types/edges";
import type { ConfigIssue } from "@/types/validation";
import type { NodePayload } from "@/types/json";
import type { NodeOutput, StepContext } from "./types";
import { manualTrigger, scheduleTrigger, webhookTrigger } from "./node-defs/triggers";
import {
  aiPrompt,
  condition,
  delay,
  httpRequest,
  textFormatter,
  transform,
} from "./node-defs/actions";
import {
  emailOutput,
  logOutput,
  sheetsOutput,
  slackOutput,
} from "./node-defs/outputs";

export type PortSpec = {
  id: SourceHandleId | "in";
  label: string;
};

export type NodeTypeDef<T extends NodeType = NodeType> = {
  type: T;
  category: NodeCategory;
  title: string;
  description: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  defaultConfig: NodeConfigOf<T>;
  /** Simulated latency; clamped into [LATENCY_MIN_MS, LATENCY_MAX_MS]. */
  latencyMs: number;
  /** Config keys that must be non-empty. Drives "missing-required-config". */
  requiredFields: string[];
  validateConfig(config: NodeConfigOf<T>): ConfigIssue[];
  /**
   * Produce this node's output payload.
   *
   * Lives beside the metadata rather than in a parallel `executors/` directory:
   * a node type's behaviour is defined by the same config shape its validation
   * checks, and splitting them invites the two drifting apart.
   */
  execute(input: NodePayload, config: NodeConfigOf<T>, ctx: StepContext): Promise<NodeOutput>;
};

/** Type-erased view used by the registry map and the palette. */
export type AnyNodeTypeDef = {
  type: NodeType;
  category: NodeCategory;
  title: string;
  description: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  defaultConfig: NodeConfig;
  latencyMs: number;
  requiredFields: string[];
  validateConfig(config: NodeConfig): ConfigIssue[];
  execute(input: NodePayload, config: NodeConfig, ctx: StepContext): Promise<NodeOutput>;
};

/**
 * Identity helper that also widens `NodeTypeDef<T>` to `AnyNodeTypeDef`.
 *
 * The cast is required because `validateConfig` is contravariant in its config
 * parameter: a `(ManualTriggerConfig) => ConfigIssue[]` is not assignable to
 * `(NodeConfig) => ConfigIssue[]`. Narrowing back is safe at the call site, which
 * always looks the definition up by the same `type` it uses to type the config.
 */
export function defineNode<T extends NodeType>(def: NodeTypeDef<T>): AnyNodeTypeDef {
  return def as unknown as AnyNodeTypeDef;
}

export function clampLatency(ms: number): number {
  return Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms));
}

/**
 * Every node type, in palette order: triggers, then actions, then outputs.
 * Adding a node type means one entry here plus one in components/nodes/registry.tsx.
 */
const NODE_TYPES: readonly AnyNodeTypeDef[] = [
  manualTrigger,
  webhookTrigger,
  scheduleTrigger,
  aiPrompt,
  httpRequest,
  transform,
  condition,
  delay,
  textFormatter,
  emailOutput,
  slackOutput,
  sheetsOutput,
  logOutput,
];

const NODE_TYPE_MAP: ReadonlyMap<NodeType, AnyNodeTypeDef> = new Map(
  NODE_TYPES.map((def) => [def.type, def]),
);

export function getNodeDef(type: NodeType): AnyNodeTypeDef | undefined {
  return NODE_TYPE_MAP.get(type);
}

export function requireNodeDef(type: NodeType): AnyNodeTypeDef {
  const def = NODE_TYPE_MAP.get(type);
  if (!def) {
    throw new Error(`No node definition registered for "${type}"`);
  }
  return def;
}

/** All registered types — the palette renders exactly this list. */
export function listNodeDefs(): readonly AnyNodeTypeDef[] {
  return NODE_TYPES;
}

export function isNodeTypeImplemented(type: NodeType): boolean {
  return NODE_TYPE_MAP.has(type);
}

export function nodeCategoryOf(type: NodeType): NodeCategory {
  return NODE_CATEGORY[type];
}

/* ------------------------------------------------------------------ *
 * Node construction
 * ------------------------------------------------------------------ */

let nodeCounter = 0;

/**
 * Build a node of the given type at a canvas position.
 * Generic in `T` so callers reach type-specific config without casting.
 */
export function createFlowNode<T extends NodeType>(
  type: T,
  position: { x: number; y: number },
  idPrefix?: string,
): FlowNodeOf<T> {
  const def = requireNodeDef(type);
  nodeCounter += 1;
  const id = `${idPrefix ?? def.type.split(".")[1]}-${nodeCounter}`;

  // The single cast is safe because `type`, `defaultConfig` and the returned
  // generic all originate from the same registry lookup.
  return {
    id,
    type,
    position,
    width: NODE_WIDTH,
    data: {
      label: def.title,
      config: structuredClone(def.defaultConfig) as NodeConfigOf<T>,
      simulateFailure: false,
    },
  } as FlowNodeOf<T>;
}

/** Reset the id counter — used by tests and when a workflow is replaced wholesale. */
export function resetNodeIdCounter(): void {
  nodeCounter = 0;
}

/** Convenience re-export so callers do not need to know which module owns edges. */
export { createFlowEdge };
