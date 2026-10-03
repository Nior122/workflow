"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, nodeAccentVars } from "@/config/theme";
import { NODE_WIDTH } from "@/config/constants";
import { SOURCE_HANDLE_OUT, TARGET_HANDLE_IN } from "@/types/edges";
import type { NodeCategory } from "@/types/nodes";
import { useUiStore } from "@/store/uiStore";

export type BaseNodeProps = {
  label: string;
  category: NodeCategory;
  accent: string;
  icon: LucideIcon;
  /** One-line summary of the node's current config. */
  summary?: ReactNode;
  /** Extra body content. Phase 2 mounts config forms here. */
  children?: ReactNode;
  hasInput: boolean;
  /** Handle ids on the output side; ["out"] for everything except conditions. */
  outputs: string[];
  selected?: boolean;
};

/**
 * Shared chrome for every node type: icon tile, label, category badge, ports,
 * selection ring and the drop-in entry animation.
 *
 * Node-type components stay presentational and never read graph state from the
 * store directly — that keeps React Flow's internal store authoritative during
 * drags and avoids the double-render trap noted in PROJECT_NOTES.md §8.
 */
function BaseNodeInner({
  label,
  category,
  accent,
  icon: Icon,
  summary,
  children,
  hasInput,
  outputs,
  selected,
}: BaseNodeProps) {
  const isRunning = useUiStore((state) => state.isRunning);

  return (
    <motion.div
      // Animate on mount only; position changes come from React Flow's transform.
      initial={{ opacity: 0, scale: 0.92, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.7 }}
      style={{ ...nodeAccentVars(accent), width: NODE_WIDTH }}
      className={cn(
        "ff-node relative rounded-lg border border-border bg-surface-raised text-left",
        "shadow-[0_1px_2px_rgb(0_0_0/0.3),0_8px_24px_-12px_rgb(0_0_0/0.5)]",
        "transition-[border-color,box-shadow] duration-200",
        selected && "border-[var(--node-accent)] glow-accent",
        isRunning && !selected && "opacity-95",
      )}
    >
      {/* Accent spine down the left edge — the node's colour signature. */}
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-[var(--node-accent)]"
      />

      <header className="flex items-start gap-2.5 px-3.5 pt-3 pb-2">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border"
          style={{
            borderColor: "rgb(var(--node-accent-rgb) / 0.35)",
            backgroundColor: "rgb(var(--node-accent-rgb) / 0.14)",
            color: "var(--node-accent)",
          }}
        >
          <Icon className="size-4" strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm leading-tight font-semibold text-foreground">
            {label}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {CATEGORY_LABEL[category]}
          </p>
        </div>
      </header>

      {(summary || children) && (
        <div className="border-t border-border/70 px-3.5 py-2.5">
          {summary}
          {children}
        </div>
      )}

      {hasInput && (
        <Handle
          id={TARGET_HANDLE_IN}
          type="target"
          position={Position.Left}
          aria-label={`Input for ${label}`}
        />
      )}

      {outputs.map((handleId, index) => (
        <Handle
          key={handleId}
          id={handleId}
          type="source"
          position={Position.Right}
          // A single output sits centred; two (true/false) split evenly.
          style={{ top: outputs.length === 1 ? "50%" : `${((index + 1) / (outputs.length + 1)) * 100}%` }}
          aria-label={
            handleId === SOURCE_HANDLE_OUT
              ? `Output for ${label}`
              : `${handleId} branch for ${label}`
          }
        />
      ))}
    </motion.div>
  );
}

export const BaseNode = memo(BaseNodeInner);
