/**
 * Unified declarative node registry types.
 *
 * RULE: Nothing in `types/**`, `lib/nodes/**`, or `lib/engine/**` may import React,
 * `@xyflow/react` runtime values, or Zustand. Icons are referenced by string keys
 * (e.g. "brand:whatsapp" or "lucide:Webhook") and resolved in the UI layer.
 */

import type { Faker } from "@faker-js/faker";
import type { JsonObject, JsonValue } from "./json";
import type { ConfigIssue } from "./validation";
import type { VariableScope } from "@/lib/engine/variables";

export type NodeKind =
  | "trigger"
  | "action"
  | "output"
  | "logic"
  | "ai-agent"
  | "ai-model"
  | "ai-memory"
  | "ai-tool"
  | "annotation";

/** The six discovery categories used by the palette accordions. */
export type RegistryCategory =
  | "trigger"
  | "ai"
  | "messaging"
  | "data"
  | "business"
  | "logic"
  | "output";

/** @deprecated Prefer `RegistryCategory`; kept as an alias for readability. */
export type PaletteCategory = RegistryCategory;

export type HandleDataType = "main" | "ai_model" | "ai_memory" | "ai_tool";

export type PortKind = HandleDataType;

export type HandlePosition = "left" | "right" | "top" | "bottom";

export type HandleSpec = {
  id: string;
  label: string;
  type: HandleDataType;
  position?: HandlePosition;
  required?: boolean;
  maxConnections?: number;
};

export type FieldType =
  | "text"
  | "textarea"
  | "expression"
  | "select"
  | "multiselect"
  | "number"
  | "slider"
  | "boolean"
  | "keyValue"
  | "json"
  | "code"
  | "credential";

export type FieldOption = {
  value: string;
  label: string;
  description?: string;
};

export type ConfigFieldSchema = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: JsonValue;
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  rows?: number;
  language?: "javascript" | "sql" | "json" | "markdown";
  credentialProvider?: string;
  keyLabel?: string;
  valueLabel?: string;
  showWhen?: {
    key: string;
    equals: string | boolean | readonly string[];
  };
};

/** n8n-style item envelope: every node passes an array of items downstream. */
export type FlowItem = {
  json: JsonObject;
};

export type ConnectedSubNodeInfo = {
  nodeId: string;
  typeId: string;
  label: string;
  config: JsonObject;
  edgeId?: string;
};

/** @deprecated Prefer `ConnectedSubNodeInfo`. */
export type ConnectedSubNode = ConnectedSubNodeInfo;

export type ConnectedSubNodes = {
  model?: ConnectedSubNodeInfo;
  memory?: ConnectedSubNodeInfo;
  tools: ConnectedSubNodeInfo[];
};

export type AgentTraceEntry = {
  step: number;
  thought: string;
  tool: string | null;
  toolLabel?: string;
  subNodeId?: string;
  toolInput: string | null;
  observation: string | null;
  durationMs: number;
  nestedTrace?: AgentTraceEntry[];
};

/** Simulated token usage and cost accounting for AI nodes. */
export type TokenUsageSummary = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type SimulateContext = {
  nodeId: string;
  nodeLabel: string;
  /** Incoming items (always >= 1 item when triggered). */
  items: readonly FlowItem[];
  /** Index of the item currently being simulated (item-based execution). */
  itemIndex?: number;
  /** Raw fully-merged payload, convenient for simple nodes. */
  input?: JsonObject;
  /** Expression resolver for `{{ $json.x }}`, `{{dot.path}}`, helpers, etc. */
  resolveExpression: (template: string, itemIndex?: number) => string;
  /** Variable scope backing `resolveExpression`, for node authors who need more. */
  scope?: VariableScope;
  /** Connected AI sub-nodes when running an `ai-agent` node. */
  subNodes?: ConnectedSubNodes;
  /** Deterministic faker instance seeded from `random()`. */
  faker: Faker;
  /** Injected deterministic RNG in [0, 1). */
  random: () => number;
  /** Injected clock. */
  now: () => number;
  /** Injected sleep (already scaled by speed where appropriate). */
  sleep: (ms: number) => Promise<void>;
  speed: 0.5 | 1 | 2;
};

export type SimulateResult = {
  /** Single JSON payload or array of n8n-style items (`FlowItem[]`). */
  output: JsonObject | FlowItem[];
  /** Output handle id (default "out"). */
  outputHandle?: string;
  /** Console log lines emitted by this step. */
  logs?: string[];
  /** Extra metadata surfaced in the run console. */
  meta?: JsonObject;
  /** Reasoning trace when the node is an AI Agent. */
  agentTrace?: AgentTraceEntry[];
  /** Alias accepted by the executor bridge. */
  trace?: AgentTraceEntry[];
  /** Simulated token and cost metrics for AI nodes. */
  tokenUsage?: TokenUsageSummary;
  /** Number of items emitted when `output` is a JSON payload. */
  itemCount?: number;
  /** Human-in-the-loop pause request (`logic.waitForApproval`). */
  pauseForApproval?: {
    summary: string;
    details?: JsonObject;
  };
};

export type RegistryNodeDef = {
  id: string;
  label: string;
  description: string;
  category: RegistryCategory;
  subcategory: string;
  keywords: readonly string[];
  /** "brand:<slug>" or "lucide:<IconName>". */
  icon: string;
  accent: string;
  type: NodeKind;
  inputs: readonly HandleSpec[];
  outputs: readonly HandleSpec[];
  configSchema: readonly ConfigFieldSchema[];
  defaultConfig: JsonObject;
  /** Static sample output displayed in the inspector before running. */
  sampleOutput: JsonObject;
  /** Simulated execution latency in ms (clamped to [300, 1200]). */
  latencyMs?: number;
  /** Default credential provider when a node declares no explicit credential field. */
  credentialProvider?: string;
  /**
   * Optional extra config validation rules beyond schema `required` checks.
   *
   * `Record<string, unknown>` rather than `JsonObject` so a node definition can
   * narrow its own config (e.g. `KeyValuePair[]` for a key-value editor) without a
   * cast at every definition site.
   */
  validateConfig?: (config: Record<string, unknown>) => ConfigIssue[];
  /** Pure simulation handler. */
  simulate: (
    input: JsonObject,
    config: Record<string, unknown>,
    context: SimulateContext,
  ) => Promise<SimulateResult> | SimulateResult;
};
