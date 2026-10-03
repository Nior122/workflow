"use client";

import {
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
import type {
  AiPromptConfig,
  ConditionConfig,
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

/**
 * UI-side counterpart to `lib/engine/registry.ts`.
 *
 * That module owns behaviour and metadata (ports, defaults, latency, validation)
 * and must stay free of React. This one owns presentation: icon, accent colour and
 * the one-line summary shown in the node body. Both are keyed by the same NodeType,
 * so a new node type needs one entry in each and nothing else.
 */
export type NodeUiDef = {
  type: NodeType;
  category: NodeCategory;
  icon: LucideIcon;
  accent: string;
  /** One-line description of the current config, shown in the node body. */
  summarize: (config: NodeConfig) => string;
};

/**
 * Warm throughout, in three families: triggers amber, actions ember, outputs stone.
 * Deliberately no blue or purple, so nothing competes with the ember brand accent,
 * and no node sits close to the error red.
 */
const ACCENTS = {
  "trigger.manual": "#F5B301",
  "trigger.webhook": "#E0913D",
  "trigger.schedule": "#C9A227",
  "action.aiPrompt": "#FFA23A",
  "action.httpRequest": "#FF6B35",
  "action.transform": "#F2884B",
  "action.condition": "#E4633F",
  "action.delay": "#B98A5A",
  "action.textFormatter": "#FF8A5C",
  "output.email": "#A8A29E",
  "output.slack": "#8FA79A",
  "output.sheets": "#7FA88F",
  "output.log": "#8B93A7",
} as const satisfies Record<NodeType, string>;

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

const SUMMARIES: Record<NodeType, Summary<NodeConfig>> = {
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

const ICONS: Record<NodeType, LucideIcon> = {
  "trigger.manual": Play,
  "trigger.webhook": Webhook,
  "trigger.schedule": CalendarClock,
  "action.aiPrompt": Sparkles,
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

const FALLBACK_ICON = Terminal;

/**
 * Presentation metadata for a node type.
 *
 * Falls back to a neutral icon and the category colour rather than throwing, so an
 * imported workflow containing a type this build does not know still renders.
 */
export function getNodeUi(type: NodeType): NodeUiDef {
  const engineDef = requireNodeDef(type);
  return {
    type,
    category: engineDef.category,
    icon: ICONS[type] ?? FALLBACK_ICON,
    accent: ACCENTS[type] ?? "#A8A29E",
    summarize: SUMMARIES[type] ?? (() => engineDef.title),
  };
}

/** Summarise a node's config for its body, never throwing on malformed config. */
export function summarizeConfig(type: NodeType, config: NodeConfig): string {
  try {
    return SUMMARIES[type]?.(config) ?? requireNodeDef(type).title;
  } catch {
    return "unconfigured";
  }
}
