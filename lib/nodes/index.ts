/**
 * Master Node Registry — single source of truth for all 144 nodes across
 * Triggers, Messaging/Outputs, Data & Storage, Business & Productivity,
 * Logic & Flow Control, and AI / Agent Sub-Nodes.
 *
 * Pure TypeScript — zero React / React Flow / Zustand runtime imports.
 */

import type { RegistryCategory, RegistryNodeDef } from "@/types/registry";
import { TRIGGER_NODES } from "./triggers";
import { MESSAGING_NODES } from "./messaging";
import { DATA_NODES } from "./data";
import { BUSINESS_NODES } from "./business";
import { LOGIC_NODES } from "./logic";
import { AI_NODES } from "./ai";

export { TRIGGER_NODES } from "./triggers";
export { MESSAGING_NODES } from "./messaging";
export { DATA_NODES } from "./data";
export { BUSINESS_NODES } from "./business";
export { LOGIC_NODES } from "./logic";
export { AI_NODES } from "./ai";
export * from "./credentials";
export * from "./faker-seed";
export * from "./helpers";

export const ALL_REGISTRY_NODES: readonly RegistryNodeDef[] = [
  ...TRIGGER_NODES,
  ...AI_NODES,
  ...LOGIC_NODES,
  ...MESSAGING_NODES,
  ...DATA_NODES,
  ...BUSINESS_NODES,
];

const REGISTRY_MAP: ReadonlyMap<string, RegistryNodeDef> = new Map(
  ALL_REGISTRY_NODES.map((node) => [node.id, node]),
);

export function listRegistryNodes(): readonly RegistryNodeDef[] {
  return ALL_REGISTRY_NODES;
}

export function getRegistryNode(id: string): RegistryNodeDef | undefined {
  return REGISTRY_MAP.get(id);
}

export function requireRegistryNode(id: string): RegistryNodeDef {
  const found = REGISTRY_MAP.get(id);
  if (!found) {
    throw new Error(`No registry node definition registered for "${id}"`);
  }
  return found;
}

export function isRegistryNodeImplemented(id: string): boolean {
  return REGISTRY_MAP.has(id);
}

export function listRegistryNodesByCategory(
  category: RegistryCategory,
): readonly RegistryNodeDef[] {
  return ALL_REGISTRY_NODES.filter((node) => node.category === category);
}

export const REGISTRY_CATEGORY_ORDER: readonly RegistryCategory[] = [
  "trigger",
  "ai",
  "logic",
  "messaging",
  "data",
  "business",
  "output",
];

export const REGISTRY_CATEGORY_META: Record<
  RegistryCategory,
  { label: string; description: string; accent: string }
> = {
  trigger: {
    label: "Triggers",
    description: "Events, webhooks, schedules, and app listeners that start a workflow",
    accent: "#FF6B35",
  },
  ai: {
    label: "AI, Agents & Sub-Nodes",
    description: "Autonomous AI Agents, LLM chains, RAG, Chat Models, Memory, and Tools",
    accent: "#FF9F43",
  },
  logic: {
    label: "Logic & Flow Control",
    description: "IF, Switch, Merge, Loops, Human Approval, Code, HTTP, and data transforms",
    accent: "#E4633F",
  },
  messaging: {
    label: "Messaging & Social",
    description: "WhatsApp, Telegram, Gmail, Slack, Discord, X, Instagram, and SMS",
    accent: "#25D366",
  },
  data: {
    label: "Data & Storage",
    description: "Postgres, Supabase, MongoDB, Redis, Sheets, Notion, Drive, S3, and Pinecone",
    accent: "#38BDF8",
  },
  business: {
    label: "Business & Productivity",
    description: "Stripe, Paystack, Flutterwave, Shopify, HubSpot, Jira, Calendar, and Zoom",
    accent: "#635BFF",
  },
  output: {
    label: "Outputs & Responses",
    description: "Terminal delivery sinks and webhook responses",
    accent: "#7FA88F",
  },
};

/**
 * Search nodes by label, description, id, category, subcategory, or keywords.
 */
export function searchRegistryNodes(query: string): readonly RegistryNodeDef[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return ALL_REGISTRY_NODES;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return ALL_REGISTRY_NODES.filter((node) => {
    const haystack = [
      node.id,
      node.label,
      node.description,
      node.category,
      node.subcategory,
      REGISTRY_CATEGORY_META[node.category]?.label ?? "",
      ...node.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}
