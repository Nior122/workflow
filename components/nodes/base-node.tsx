"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, nodeAccentVars } from "@/config/theme";
import { NODE_WIDTH } from "@/config/constants";
import { SOURCE_HANDLE_OUT, TARGET_HANDLE_IN } from "@/types/edges";
import type { NodeCategory } from "@/types/nodes";
import type { ValidationIssue } from "@/types/validation";
import type { NodeRunStatus } from "@/types/run";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  /** Blocking issues; renders a red ring plus a badge listing them. */
  errors?: ValidationIssue[];
  /** Live execution status, drives the pulse / check / shake / dim states. */
  status?: NodeRunStatus;
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
  errors,
  status = "idle",
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
        errors && errors.length > 0 && "border-error/70 glow-error",
        isRunning && !selected && "opacity-95",
      )}
    >
      {/* Accent spine down the left edge — the node's colour signature. */}
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-[var(--node-accent)]"
      />

      {/* Live status: a pulsing ring while running, a check once done. */}
      {status === "running" && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-accent"
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.99, 1.02, 0.99] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {(status === "running" || status === "success" || status === "error") && (
        <span
          role="status"
          aria-label={`Node status: ${status}`}
          className={cn(
            "absolute -bottom-2 -right-2 z-canvas-overlay grid size-5 place-items-center rounded-full",
            "border bg-surface-raised shadow",
            status === "running" && "border-accent text-accent",
            status === "success" && "border-success text-success",
            status === "error" && "border-error text-error",
          )}
        >
          {status === "running" ? (
            <motion.span
              aria-hidden
              className="size-2.5 rounded-full border-2 border-accent border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          ) : status === "success" ? (
            <Check className="size-3" aria-hidden strokeWidth={3} />
          ) : (
            <AlertTriangle className="size-3" aria-hidden strokeWidth={2.5} />
          )}
        </span>
      )}

      {errors && errors.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              aria-label={`${errors.length} configuration ${errors.length === 1 ? "error" : "errors"}`}
              className="absolute -top-2 -right-2 z-canvas-overlay grid size-5 cursor-help place-items-center rounded-full border border-error bg-surface-raised text-error shadow"
            >
              <AlertTriangle className="size-3" aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 border-error/40">
            <ul className="space-y-1">
              {errors.map((issue) => (
                <li key={`${issue.code}-${issue.message}`} className="flex gap-2">
                  <span aria-hidden className="text-error">
                    &bull;
                  </span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}

      <header className="flex items-center gap-3 px-3 py-3">
        {/* Tinted, borderless: the accent colour already carries the category, so a
            bordered tile plus an uppercase label was saying the same thing twice. */}
        <span
          aria-hidden
          className="mt-px grid size-7 shrink-0 place-items-center rounded-md"
          style={{
            backgroundColor: "rgb(var(--node-accent-rgb) / 0.14)",
            color: "var(--node-accent)",
          }}
        >
          <Icon className="size-4" strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] leading-tight font-semibold text-foreground">
            {label}
          </h3>
          <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">
            {CATEGORY_LABEL[category]}
          </p>
        </div>
      </header>

      {(summary || children) && (
        <div className="border-t border-border/70 px-3 py-2">
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
