"use client";

import {
  Bot,
  CalendarClock,
  Globe,
  GitBranch,
  Mail,
  MessageSquare,
  Play,
  Sheet,
  Shuffle,
  Sparkles,
  Terminal,
  Timer,
  Type,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { parseJsonObject } from "@/types/json";
import { requireNodeDef } from "@/lib/engine/registry";
import { getRegistryNode } from "@/lib/nodes";
import { resolveNodeIcon } from "./icon-resolver";
import type {
  AiAgentConfig,
  AiPromptConfig,
  ConditionConfig,
  CoreNodeType,
  DelayConfig,
  EmailConfig,
  HttpRequestConfig,
  LogConfig,
  ManualTriggerConfig,
  NodeCategory,
  NodeConfig,
  NodeType,
  ScheduleTriggerConfig,
  SheetsConfig,
  SlackConfig,
  TextFormatterConfig,
  TransformConfig,
  WebhookTriggerConfig,
} from "@/types/nodes";
import type { HandleSpec, NodeKind, RegistryCategory } from "@/types/registry";

export type NodeUiDef = {
  type: NodeType;
  category: NodeCategory;
  registryCategory?: RegistryCategory;
  subcategory?: string;
  nodeKind?: NodeKind;
  inputs?: readonly HandleSpec[];
  outputs?: readonly HandleSpec[];
  icon: LucideIcon;
  accent: string;
  /** One-line description of the current config, shown in the node body. */
  summarize: (config: NodeConfig) => string;
};

/** Per-node accent colours for the 14 core node types. */
export const ACCENTS: Record<CoreNodeType, string> = {
  "trigger.manual": "#F5B301",
  "trigger.webhook": "#E0913D",
  "trigger.schedule": "#C9A227",
  "action.aiPrompt": "#FFA23A",
  "action.aiAgent": "#FF7847",
  "action.httpRequest": "#FF6B35",
  "action.transform": "#F2884B",
  "action.condition": "#E4633F",
  "action.delay": "#B98A5A",
  "action.textFormatter": "#FF8A5C",
  "output.email": "#A8A29E",
  "output.slack": "#8FA79A",
  "output.sheets": "#7FA88F",
  "output.log": "#8B93A7",
};

function truncate(value: string, max = 46): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function jsonSummary(raw: string, emptyLabel: string): string {
  const parsed = parseJsonObject(raw);
  if (!parsed.ok) return "invalid JSON";
  const keys = Object.keys(parsed.value);
  return keys.length === 0 ? emptyLabel : `${keys.length} field${keys.length === 1 ? "" : "s"}`;
}

type Summary<T extends NodeConfig> = (config: T) => string;

const SUMMARIES: Record<string, Summary<NodeConfig>> = {
  "trigger.manual": ((config: ManualTriggerConfig) =>
    jsonSummary(config.payloadJson, "empty payload")) as Summary<NodeConfig>,

  "trigger.webhook": ((config: WebhookTriggerConfig) =>
    jsonSummary(config.samplePayloadJson, "empty payload")) as Summary<NodeConfig>,

  "trigger.schedule": ((config: ScheduleTriggerConfig) =>
    config.cron.trim() || "no schedule") as Summary<NodeConfig>,

  "action.aiPrompt": ((config: AiPromptConfig) =>
    config.promptTemplate.trim()
      ? truncate(config.promptTemplate)
      : "prompt template required") as Summary<NodeConfig>,

  "action.aiAgent": ((config: AiAgentConfig) =>
    config.goal.trim()
      ? `${config.tools.length} tool${config.tools.length === 1 ? "" : "s"} · ${truncate(config.goal, 34)}`
      : "goal required") as Summary<NodeConfig>,

  "action.httpRequest": ((config: HttpRequestConfig) =>
    config.url.trim()
      ? `${config.method} ${truncate(config.url, 38)}`
      : "no URL") as Summary<NodeConfig>,

  "action.transform": ((config: TransformConfig) =>
    config.fields.length === 0
      ? "no mappings"
      : `${config.fields.length} field${config.fields.length === 1 ? "" : "s"} · ${config.mode}`) as Summary<
    NodeConfig
  >,

  "action.condition": ((config: ConditionConfig) =>
    `${truncate(config.left || "?", 14)} ${config.operator} ${truncate(config.right || "?", 14)}`) as Summary<
    NodeConfig
  >,

  "action.delay": ((config: DelayConfig) =>
    `wait ${config.seconds}s`) as Summary<NodeConfig>,

  "action.textFormatter": ((config: TextFormatterConfig) =>
    config.template.trim() ? truncate(config.template) : "no template") as Summary<NodeConfig>,

  "output.email": ((config: EmailConfig) =>
    config.to.trim() ? `to ${truncate(config.to, 38)}` : "no recipient") as Summary<NodeConfig>,

  "output.slack": ((config: SlackConfig) =>
    config.channel.trim() ? truncate(config.channel, 38) : "no channel") as Summary<NodeConfig>,

  "output.sheets": ((config: SheetsConfig) =>
    config.columns.length === 0
      ? "no columns"
      : `${config.columns.length} column${config.columns.length === 1 ? "" : "s"}`) as Summary<
    NodeConfig
  >,

  "output.log": ((config: LogConfig) => config.label || "untitled log") as Summary<NodeConfig>,
};

const CORE_ICONS: Record<string, LucideIcon> = {
  "trigger.manual": Play,
  "trigger.webhook": Webhook,
  "trigger.schedule": CalendarClock,
  "action.aiPrompt": Sparkles,
  "action.aiAgent": Bot,
  "action.httpRequest": Globe,
  "action.transform": Shuffle,
  "action.condition": GitBranch,
  "action.delay": Timer,
  "action.textFormatter": Type,
  "output.email": Mail,
  "output.slack": MessageSquare,
  "output.sheets": Sheet,
  "output.log": Terminal,
};

function genericSummarize(type: NodeType, config: NodeConfig): string {
  const regNode = getRegistryNode(type);
  const cfg = (config ?? {}) as Record<string, unknown>;
  if (regNode) {
    for (const field of regNode.configSchema) {
      if (field.type === "credential") continue;
      const val = cfg[field.key];
      if (typeof val === "string" && val.trim().length > 0) {
        return truncate(`${field.label}: ${val}`, 42);
      }
      if (typeof val === "number") {
        return `${field.label}: ${val}`;
      }
    }
    return regNode.subcategory || regNode.label;
  }
  return requireNodeDef(type).title;
}

/**
 * Presentation metadata for any of the 144 node types.
 */
export function getNodeUi(type: NodeType): NodeUiDef {
  const engineDef = requireNodeDef(type);
  const regNode = getRegistryNode(type);
  const icon =
    CORE_ICONS[type] ??
    (regNode ? resolveNodeIcon(regNode.icon) : Terminal);
  const accent =
    (ACCENTS as Record<string, string>)[type] ??
    regNode?.accent ??
    "#A8A29E";

  return {
    type,
    category: engineDef.category,
    registryCategory: regNode?.category,
    subcategory: regNode?.subcategory,
    nodeKind: regNode?.type,
    inputs: regNode?.inputs,
    outputs: regNode?.outputs,
    icon,
    accent,
    summarize: SUMMARIES[type] ?? ((cfg) => genericSummarize(type, cfg)),
  };
}

/** Summarise a node's config for its body, never throwing on malformed config. */
export function summarizeConfig(type: NodeType, config: NodeConfig): string {
  try {
    if (type in SUMMARIES) {
      return SUMMARIES[type](config);
    }
    return genericSummarize(type, config);
  } catch {
    return "unconfigured";
  }
}
