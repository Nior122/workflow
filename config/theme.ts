import type { CSSProperties } from "react";
import type { NodeCategory, NodeType } from "@/types/nodes";

/**
 * Per-node accent colours.
 *
 * Triggers lean amber, actions lean ember, outputs lean a warm stone — so the
 * canvas reads as a left-to-right temperature gradient without every node
 * competing for attention against the ember brand accent.
 */
export const CATEGORY_ACCENT: Record<NodeCategory, string> = {
  trigger: "#F5B301",
  action: "#FF6B35",
  output: "#A8A29E",
};

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  trigger: "Trigger",
  action: "Action",
  output: "Output",
};

/** Overrides for specific node types where the category colour is too generic. */
const NODE_ACCENT_OVERRIDES: Partial<Record<NodeType, string>> = {
  "action.aiPrompt": "#FFA23A",
  "output.log": "#8B93A7",
};

export function accentFor(type: NodeType, category: NodeCategory): string {
  return NODE_ACCENT_OVERRIDES[type] ?? CATEGORY_ACCENT[category];
}

/** Convert "#RRGGBB" to "R G B" so `rgb(var(--x) / 0.2)` style alpha works inline. */
export function hexToRgbChannels(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Inline style vars for a node, so its glow and border follow its own accent. */
export function nodeAccentVars(hex: string): CSSProperties {
  return { "--node-accent": hex, "--node-accent-rgb": hexToRgbChannels(hex) } as CSSProperties;
}
