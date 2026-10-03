/**
 * Pure node-type metadata.
 *
 * RULE: nothing in `lib/engine/**` may import React, @xyflow/react, or Zustand.
 * This module is the contract between the execution engine and the UI — it owns
 * ports, default configs, latency and config validation. Icons, accent colours and
 * config form components live in `components/nodes/registry.tsx`, keyed by the same
 * NodeType.
 */

import { LATENCY_MAX_MS, LATENCY_MIN_MS, NODE_WIDTH } from "@/config/constants";
import { parseJsonObject } from "@/types/json";
import {
  NODE_CATEGORY,
  type AiPromptConfig,
  type FlowNodeOf,
  type LogConfig,
  type ManualTriggerConfig,
  type NodeCategory,
  type NodeConfig,
  type NodeConfigOf,
  type NodeType,
} from "@/types/nodes";
import {
  SOURCE_HANDLE_OUT,
  TARGET_HANDLE_IN,
  createFlowEdge,
  type SourceHandleId,
} from "@/types/edges";
import type { ConfigIssue } from "@/types/validation";

export type PortSpec = {
  id: SourceHandleId | typeof TARGET_HANDLE_IN;
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
};

/**
 * Identity helper that also widens `NodeTypeDef<T>` to `AnyNodeTypeDef`.
 *
 * The cast is required because `validateConfig` is contravariant in its config
 * parameter: a `(ManualTriggerConfig) => ConfigIssue[]` is not assignable to
 * `(NodeConfig) => ConfigIssue[]`. Narrowing back is safe at the call site, which
 * always looks the definition up by the same `type` it uses to type the config.
 */
function defineNode<T extends NodeType>(def: NodeTypeDef<T>): AnyNodeTypeDef {
  return def as unknown as AnyNodeTypeDef;
}

export function clampLatency(ms: number): number {
  return Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms));
}

/* ------------------------------------------------------------------ *
 * Implemented node types
 *
 * Phase 1 ships these three. Phase 2 adds the remaining ten; the palette
 * renders straight from this registry, so it grows automatically.
 * ------------------------------------------------------------------ */

const manualTrigger = defineNode<"trigger.manual">({
  type: "trigger.manual",
  category: "trigger",
  title: "Manual Trigger",
  description: "Starts the flow when you press Run, with a sample payload you control.",
  inputs: [],
  outputs: [{ id: SOURCE_HANDLE_OUT, label: "Output" }],
  defaultConfig: {
    payloadJson: JSON.stringify(
      {
        user: { name: "Ada Lovelace", email: "ada@example.com", plan: "pro" },
        source: "landing-page",
        budget: 1200,
      },
      null,
      2,
    ),
  } satisfies ManualTriggerConfig,
  latencyMs: LATENCY_MIN_MS,
  requiredFields: [],
  validateConfig(config) {
    const result = parseJsonObject(config.payloadJson);
    if (!result.ok) {
      return [
        {
          code: "invalid-json",
          level: "error",
          message: `Sample payload: ${result.error}`,
          field: "config.payloadJson",
        },
      ];
    }
    return [];
  },
});

const aiPrompt = defineNode<"action.aiPrompt">({
  type: "action.aiPrompt",
  category: "action",
  title: "AI Prompt",
  description: "Sends a templated prompt to a simulated model and returns canned text.",
  inputs: [{ id: TARGET_HANDLE_IN, label: "Input" }],
  outputs: [{ id: SOURCE_HANDLE_OUT, label: "Output" }],
  defaultConfig: {
    systemPrompt: "You are a concise, friendly assistant.",
    promptTemplate: "Write a short reply to {{user.name}} about their {{source}} signup.",
    model: "ff-pro",
    temperature: 0.7,
  } satisfies AiPromptConfig,
  latencyMs: 1100,
  requiredFields: ["promptTemplate"],
  validateConfig(config) {
    const issues: ConfigIssue[] = [];
    if (config.promptTemplate.trim().length === 0) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "Prompt template is required.",
        field: "config.promptTemplate",
      });
    }
    if (config.temperature < 0 || config.temperature > 1) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Temperature must be between 0 and 1.",
        field: "config.temperature",
      });
    }
    return issues;
  },
});

const logOutput = defineNode<"output.log">({
  type: "output.log",
  category: "output",
  title: "Log Output",
  description: "Prints the final payload to the run console.",
  inputs: [{ id: TARGET_HANDLE_IN, label: "Input" }],
  outputs: [],
  defaultConfig: { label: "Final payload" } satisfies LogConfig,
  latencyMs: 350,
  requiredFields: [],
  validateConfig() {
    return [];
  },
});

const NODE_TYPES: readonly AnyNodeTypeDef[] = [manualTrigger, aiPrompt, logOutput];

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

/** Only the implemented types — the palette renders exactly this list. */
export function listNodeDefs(): readonly AnyNodeTypeDef[] {
  return NODE_TYPES;
}

export function isNodeTypeImplemented(type: NodeType): boolean {
  return NODE_TYPE_MAP.has(type);
}

/* ------------------------------------------------------------------ *
 * Node construction
 * ------------------------------------------------------------------ */

let nodeCounter = 0;

/**
 * Build a node of the given type at a canvas position.
 * `idPrefix` keeps ids readable ("ai-1") without needing a UUID per node.
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

/** Sanity check used by tests and the validator. */
export function nodeCategoryOf(type: NodeType): NodeCategory {
  return NODE_CATEGORY[type];
}
