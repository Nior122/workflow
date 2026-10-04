/**
 * Pure node-type metadata & bridge to the 144-node Master Registry (`/lib/nodes/`).
 *
 * RULE: nothing in `lib/engine/**` may import React, @xyflow/react, or Zustand.
 */

import { LATENCY_MAX_MS, LATENCY_MIN_MS, NODE_WIDTH } from "@/config/constants";
import {
  NODE_CATEGORY,
  nodeCategoryFromId,
  type FlowNodeOf,
  type NodeCategory,
  type NodeConfig,
  type NodeConfigOf,
  type NodeType,
} from "@/types/nodes";
import { createFlowEdge, type SourceHandleId } from "@/types/edges";
import type { ConfigIssue } from "@/types/validation";
import type { NodePayload } from "@/types/json";
import type { FlowItem, RegistryNodeDef, SimulateContext } from "@/types/registry";
import type { NodeOutput, StepContext } from "./types";
import { renderTemplate } from "./variables";
import { manualTrigger, scheduleTrigger, webhookTrigger } from "./node-defs/triggers";
import {
  aiAgent,
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
import {
  ALL_REGISTRY_NODES,
  createSeededFaker,
  validateConfigWithSchema,
} from "@/lib/nodes";

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

export function defineNode<T extends NodeType>(def: NodeTypeDef<T>): AnyNodeTypeDef {
  return def as unknown as AnyNodeTypeDef;
}

export function clampLatency(ms: number): number {
  return Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms));
}

/**
 * Adapt any declarative `RegistryNodeDef` from `/lib/nodes/<category>/` into the
 * engine's `AnyNodeTypeDef` interface so the executor and validator work uniformly
 * across all 144 nodes.
 */
function adaptRegistryNode(regNode: RegistryNodeDef): AnyNodeTypeDef {
  const mainInputs = regNode.inputs
    .filter((h) => h.type === "main")
    .map((h) => ({ id: h.id as "in", label: h.label }));

  const outputs = regNode.outputs.map((h) => ({
    id: h.id as SourceHandleId,
    label: h.label,
  }));

  return {
    type: regNode.id,
    category: nodeCategoryFromId(regNode.id),
    title: regNode.label,
    description: regNode.description,
    inputs: mainInputs,
    outputs,
    defaultConfig: regNode.defaultConfig,
    latencyMs: clampLatency(regNode.latencyMs ?? 520),
    requiredFields: regNode.configSchema.filter((f) => f.required).map((f) => f.key),
    validateConfig: (config) => {
      const cfg = (config ?? {}) as Record<string, unknown>;
      return regNode.validateConfig
        ? regNode.validateConfig(cfg)
        : validateConfigWithSchema(regNode.configSchema, cfg as NodePayload);
    },
    execute: async (input, config, ctx) => {
      const cfg = (config ?? {}) as Record<string, unknown>;
      const simCtx: SimulateContext = {
        nodeId: ctx.nodeId,
        nodeLabel: ctx.nodeLabel ?? regNode.label,
        items: ctx.items ?? [{ json: input }],
        itemIndex: 0,
        scope: ctx.scope,
        subNodes: ctx.subNodes ?? { tools: [] },
        faker: createSeededFaker(ctx.random),
        random: ctx.random,
        now: ctx.now,
        sleep: ctx.sleep,
        speed: ctx.speed,
        resolveExpression: (expr: string) => renderTemplate(expr, ctx.scope).text,
      };

      const res = await regNode.simulate(input, cfg, simCtx);
      const rawOutput = res.output;
      const items: FlowItem[] = Array.isArray(rawOutput)
        ? (rawOutput as FlowItem[])
        : [];
      // n8n-style item arrays get flattened into the payload so downstream
      // `{{ $json.field }}` expressions keep working exactly as before, while
      // `items` / `itemCount` stay available for Loop nodes and edge badges.
      const payload: NodePayload =
        items.length > 0
          ? {
              items: items.map((item) => item.json),
              itemCount: items.length,
              ...(items[0]?.json ?? {}),
            }
          : (rawOutput as NodePayload);
      const itemCount = items.length > 0 ? items.length : (res.itemCount ?? 1);

      return {
        payload,
        outputHandle: res.outputHandle ?? "out",
        meta: res.meta,
        trace: res.agentTrace,
        logs: res.logs,
        tokenUsage: res.tokenUsage,
        itemCount,
        pauseForApproval: res.pauseForApproval,
      };
    },
  };
}

/**
 * The original 14 core node definitions in their canonical v1 order.
 */
const CORE_NODE_TYPES: readonly AnyNodeTypeDef[] = [
  manualTrigger,
  webhookTrigger,
  scheduleTrigger,
  aiPrompt,
  aiAgent,
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

const CORE_ID_SET = new Set<string>(CORE_NODE_TYPES.map((def) => def.type));

/**
 * All 144 node definitions (14 core + 130 additional registry definitions).
 */
const ALL_NODE_TYPES: readonly AnyNodeTypeDef[] = [
  ...CORE_NODE_TYPES,
  ...ALL_REGISTRY_NODES.filter((reg) => !CORE_ID_SET.has(reg.id)).map(adaptRegistryNode),
];

const NODE_TYPE_MAP: ReadonlyMap<NodeType, AnyNodeTypeDef> = new Map(
  ALL_NODE_TYPES.map((def) => [def.type, def]),
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

/** Returns the 14 canonical core node definitions (preserves v1 test contracts). */
export function listNodeDefs(): readonly AnyNodeTypeDef[] {
  return CORE_NODE_TYPES;
}

/** Returns all 144 node definitions across all categories. */
export function listAllNodeDefs(): readonly AnyNodeTypeDef[] {
  return ALL_NODE_TYPES;
}

export function isNodeTypeImplemented(type: NodeType): boolean {
  return NODE_TYPE_MAP.has(type);
}

export function nodeCategoryOf(type: NodeType): NodeCategory {
  return NODE_CATEGORY[type] ?? nodeCategoryFromId(type);
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
  const slug = def.type.includes(".") ? def.type.split(".")[1] : def.type;
  const id = `${idPrefix ?? slug}-${nodeCounter}`;

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
