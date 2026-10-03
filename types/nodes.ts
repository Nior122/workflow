import type { Node } from "@xyflow/react";
import type { ValidationIssue } from "./validation";

export type NodeCategory = "trigger" | "action" | "output";

/**
 * Every node type FlowForge knows about.
 *
 * The union is complete (all 13 types are part of the agreed data model), but the
 * runtime registries in `lib/engine/registry.ts` and `components/nodes/registry.tsx`
 * only contain the types that are actually implemented. The palette renders from the
 * registry, so nothing unimplemented is ever reachable in the UI.
 */
export type NodeType =
  // triggers — no input handle, one output
  | "trigger.manual"
  | "trigger.webhook"
  | "trigger.schedule"
  // actions — one input, one or more outputs
  | "action.aiPrompt"
  | "action.httpRequest"
  | "action.transform"
  | "action.condition"
  | "action.delay"
  | "action.textFormatter"
  // outputs — one input, no output
  | "output.email"
  | "output.slack"
  | "output.sheets"
  | "output.log";

/* ------------------------------------------------------------------ *
 * Configs — one shape per node type
 * ------------------------------------------------------------------ */

/** A single row in the key-value editors (HTTP headers, transforms, sheets columns). */
export type KeyValuePair = { id: string; key: string; value: string };

export type ManualTriggerConfig = {
  /** Editable sample JSON payload; the trigger's output. */
  payloadJson: string;
};

export type WebhookTriggerConfig = {
  /** Editable sample payload. The webhook URL itself is derived and fake. */
  samplePayloadJson: string;
};

export type ScheduleTriggerConfig = {
  /** Cron expression. Simulated: fires once per Run. */
  cron: string;
  timezone: string;
};

export type AiModel = "ff-mini" | "ff-pro";

export type AiPromptConfig = {
  systemPrompt: string;
  /** Supports {{variables}} resolved from the incoming payload. */
  promptTemplate: string;
  model: AiModel;
  /** 0..1 — influences which canned response the simulator picks. */
  temperature: number;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequestConfig = {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  /** Ignored for GET. */
  bodyJson: string;
};

export type TransformConfig = {
  /** map = replace the payload entirely; merge = spread the mapped fields over the input. */
  mode: "map" | "merge";
  /** Values may contain {{variables}}. */
  fields: KeyValuePair[];
};

export type ConditionOperator = "equals" | "notEquals" | "contains" | "gt" | "lt";

export type ConditionConfig = {
  /** {{dot.path}} or a literal. */
  left: string;
  operator: ConditionOperator;
  /** {{dot.path}} or a literal. */
  right: string;
  caseSensitive: boolean;
};

export type DelayConfig = {
  /** Scaled by the execution speed multiplier. */
  seconds: number;
};

export type TextFormatterConfig = {
  template: string;
};

export type EmailConfig = {
  to: string;
  subject: string;
  body: string;
};

export type SlackConfig = {
  channel: string;
  message: string;
};

export type SheetsConfig = {
  spreadsheet: string;
  columns: KeyValuePair[];
};

export type LogConfig = {
  label: string;
};

export type NodeConfig =
  | ManualTriggerConfig
  | WebhookTriggerConfig
  | ScheduleTriggerConfig
  | AiPromptConfig
  | HttpRequestConfig
  | TransformConfig
  | ConditionConfig
  | DelayConfig
  | TextFormatterConfig
  | EmailConfig
  | SlackConfig
  | SheetsConfig
  | LogConfig;

/** Maps a node type to its config shape so `node.data.config` is correctly typed. */
export type NodeConfigOf<T extends NodeType> = T extends "trigger.manual"
  ? ManualTriggerConfig
  : T extends "trigger.webhook"
    ? WebhookTriggerConfig
    : T extends "trigger.schedule"
      ? ScheduleTriggerConfig
      : T extends "action.aiPrompt"
        ? AiPromptConfig
        : T extends "action.httpRequest"
          ? HttpRequestConfig
          : T extends "action.transform"
            ? TransformConfig
            : T extends "action.condition"
              ? ConditionConfig
              : T extends "action.delay"
                ? DelayConfig
                : T extends "action.textFormatter"
                  ? TextFormatterConfig
                  : T extends "output.email"
                    ? EmailConfig
                    : T extends "output.slack"
                      ? SlackConfig
                      : T extends "output.sheets"
                        ? SheetsConfig
                        : T extends "output.log"
                          ? LogConfig
                          : never;

/* ------------------------------------------------------------------ *
 * React Flow node shape
 * ------------------------------------------------------------------ */

/**
 * Declared as a `type` (not an `interface`) so it satisfies React Flow's
 * `Record<string, unknown>` constraint on node data.
 */
export type FlowNodeData<T extends NodeType = NodeType> = {
  label: string;
  config: NodeConfigOf<T>;
  /** Demo switch: force this node to throw so error handling is visible. */
  simulateFailure: boolean;
  /** Per-node latency override in ms; the engine clamps it to [300, 1200]. */
  latencyMs?: number;
  /** Written by the validator; drives the red ring and tooltip on the node. */
  validation?: ValidationIssue[];
};

/** A React Flow node narrowed to a single node type. Use for `NodeProps<...>`. */
export type FlowNodeOf<T extends NodeType> = Node<FlowNodeData<T>, T>;

/** Discriminated on `type`, so `node.type` narrows `node.data.config`. */
export type FlowNode = { [T in NodeType]: FlowNodeOf<T> }[NodeType];

/** Which side of the graph a node sits on. */
export const NODE_CATEGORY: Record<NodeType, NodeCategory> = {
  "trigger.manual": "trigger",
  "trigger.webhook": "trigger",
  "trigger.schedule": "trigger",
  "action.aiPrompt": "action",
  "action.httpRequest": "action",
  "action.transform": "action",
  "action.condition": "action",
  "action.delay": "action",
  "action.textFormatter": "action",
  "output.email": "output",
  "output.slack": "output",
  "output.sheets": "output",
  "output.log": "output",
};

export function hasInput(type: NodeType): boolean {
  return NODE_CATEGORY[type] !== "trigger";
}

export function hasOutput(type: NodeType): boolean {
  return NODE_CATEGORY[type] !== "output";
}

/** Build a brand-new KeyValuePair row with a stable id. */
export function createKeyValuePair(key = "", value = ""): KeyValuePair {
  return { id: crypto.randomUUID(), key, value };
}
