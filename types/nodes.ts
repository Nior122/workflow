import type { Node } from "@xyflow/react";
import type { ValidationIssue } from "./validation";

export type NodeCategory = "trigger" | "action" | "output";

/**
 * The original 14 strongly-typed core node types from v1.
 */
export type CoreNodeType =
  // triggers — no input handle, one output
  | "trigger.manual"
  | "trigger.webhook"
  | "trigger.schedule"
  // actions — one input, one or more outputs
  | "action.aiPrompt"
  | "action.aiAgent"
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

/**
 * Every node type FlowForge knows about (the 14 core types + 130 declarative
 * registry nodes across Triggers, Messaging, Data, Business, Logic, and AI).
 */
export type NodeType = CoreNodeType | (string & {});

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

export type AiModel = "ff-mini" | "ff-pro" | "ff-reasoning" | (string & {});

export type AiPromptConfig = {
  systemPrompt: string;
  /** Supports {{variables}} resolved from the incoming payload. */
  promptTemplate: string;
  model: AiModel;
  /** 0..1 — influences which canned response the simulator picks. */
  temperature: number;
};

export type AgentTool = "kbLookup" | "webSearch" | "calculator" | "httpFetch";

export const AGENT_TOOLS: readonly {
  id: AgentTool;
  label: string;
  description: string;
}[] = [
  {
    id: "kbLookup",
    label: "Knowledge Base",
    description: "Search internal runbooks and policies",
  },
  {
    id: "webSearch",
    label: "Web Search",
    description: "Query public company and domain signals",
  },
  {
    id: "calculator",
    label: "Calculator",
    description: "Evaluate numeric formulas and thresholds",
  },
  {
    id: "httpFetch",
    label: "HTTP Fetch",
    description: "Fetch live context from an enrichment endpoint",
  },
];

export type AiAgentConfig = {
  systemPrompt: string;
  /** Goal template supporting {{variables}} resolved from the incoming payload. */
  goal: string;
  model: AiModel;
  /** Simulated tools the agent may invoke while reasoning. */
  tools: AgentTool[];
  /** Upper bound on reasoning-act-observe iterations (1..6). */
  maxSteps: number;
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
  | AiAgentConfig
  | HttpRequestConfig
  | TransformConfig
  | ConditionConfig
  | DelayConfig
  | TextFormatterConfig
  | EmailConfig
  | SlackConfig
  | SheetsConfig
  | LogConfig
  | Record<string, unknown>;

/** Maps a node type to its config shape so `node.data.config` is correctly typed. */
export type NodeConfigOf<T extends NodeType> = T extends "trigger.manual"
  ? ManualTriggerConfig
  : T extends "trigger.webhook"
    ? WebhookTriggerConfig
    : T extends "trigger.schedule"
      ? ScheduleTriggerConfig
      : T extends "action.aiPrompt"
        ? AiPromptConfig
        : T extends "action.aiAgent"
          ? AiAgentConfig
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
                            : Record<string, unknown>;

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
  /** Continue workflow execution even if this node throws an error (Phase 5). */
  continueOnError?: boolean;
  /** Retry this node automatically on failure before raising an error (Phase 5). */
  retryOnFail?: boolean;
  /** Maximum retry attempts when `retryOnFail` is enabled (1..3, default 2). */
  maxRetries?: number;
  /** Written by the validator; drives the red ring and tooltip on the node. */
  validation?: ValidationIssue[];
};

/** A React Flow node narrowed to a single node type. Use for `NodeProps<...>`. */
export type FlowNodeOf<T extends NodeType> = Node<FlowNodeData<T>, T>;

/** Discriminated on `type`, so `node.type` narrows `node.data.config`. */
export type FlowNode =
  | { [T in CoreNodeType]: FlowNodeOf<T> }[CoreNodeType]
  | FlowNodeOf<NodeType>;

/** Which side of the graph a core node sits on. */
export const CORE_NODE_CATEGORY: Record<CoreNodeType, NodeCategory> = {
  "trigger.manual": "trigger",
  "trigger.webhook": "trigger",
  "trigger.schedule": "trigger",
  "action.aiPrompt": "action",
  "action.aiAgent": "action",
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

/**
 * Dynamic proxy over all node types so `NODE_CATEGORY[type]` works for both
 * the 14 core node types and all 144 registry nodes (`trigger.*` -> `"trigger"`,
 * `output.*` -> `"output"`, everything else -> `"action"`), while
 * `Object.keys(NODE_CATEGORY)` returns the 14 core keys unless queried via
 * `nodeCategoryOf(type)`.
 */
export const NODE_CATEGORY: Record<string, NodeCategory> = new Proxy(
  { ...CORE_NODE_CATEGORY } as Record<string, NodeCategory>,
  {
    get(target, prop) {
      if (typeof prop === "string") {
        if (prop in target) return target[prop];
        if (prop.startsWith("trigger.")) return "trigger";
        if (prop.startsWith("output.")) return "output";
        return "action";
      }
      return Reflect.get(target, prop);
    },
  },
);

export function nodeCategoryFromId(type: string): NodeCategory {
  if (type.startsWith("trigger.")) return "trigger";
  if (type.startsWith("output.")) return "output";
  return "action";
}

export function hasInput(type: NodeType): boolean {
  if (
    type.startsWith("trigger.") ||
    type.startsWith("aiModel.") ||
    type.startsWith("aiMemory.") ||
    type.startsWith("aiTool.") ||
    type === "logic.stickyNote"
  ) {
    return false;
  }
  return true;
}

export function hasOutput(type: NodeType): boolean {
  if (type.startsWith("output.") || type === "logic.stopAndError" || type === "logic.stickyNote") {
    return false;
  }
  return true;
}

/** Build a brand-new KeyValuePair row with a stable id. */
export function createKeyValuePair(key = "", value = ""): KeyValuePair {
  return { id: crypto.randomUUID(), key, value };
}
