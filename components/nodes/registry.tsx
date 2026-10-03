"use client";

import { Play, Sparkles, Terminal, type LucideIcon } from "lucide-react";
import { accentFor } from "@/config/theme";
import { requireNodeDef } from "@/lib/engine/registry";
import type { NodeCategory, NodeType } from "@/types/nodes";

/**
 * UI-side counterpart to `lib/engine/registry.ts`.
 *
 * That module owns behaviour and metadata (ports, defaults, latency, validation)
 * and must stay free of React. This one owns presentation: the icon and accent
 * colour. Both are keyed by the same NodeType, so a node type added in Phase 2
 * needs one entry in each and nothing else.
 */
export type NodeUiDef = {
  type: NodeType;
  category: NodeCategory;
  icon: LucideIcon;
  accent: string;
};

const NODE_UI_DEFS: Partial<Record<NodeType, Omit<NodeUiDef, "category" | "accent">>> = {
  "trigger.manual": { type: "trigger.manual", icon: Play },
  "action.aiPrompt": { type: "action.aiPrompt", icon: Sparkles },
  "output.log": { type: "output.log", icon: Terminal },
};

/**
 * Look up presentation metadata for a node type.
 *
 * Falls back to the category icon/colour rather than throwing, so an imported
 * workflow containing a type from a newer version still renders.
 */
export function getNodeUi(type: NodeType): NodeUiDef {
  const engineDef = requireNodeDef(type);
  const explicit = NODE_UI_DEFS[type];

  return {
    type,
    category: engineDef.category,
    icon: explicit?.icon ?? Terminal,
    accent: accentFor(type, engineDef.category),
  };
}
