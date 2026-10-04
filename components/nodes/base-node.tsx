"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, nodeAccentVars } from "@/config/theme";
import { NODE_WIDTH } from "@/config/constants";
import { SOURCE_HANDLE_OUT, TARGET_HANDLE_IN } from "@/types/edges";
import type { NodeCategory } from "@/types/nodes";
import type { HandleSpec, NodeKind } from "@/types/registry";
import type { ValidationIssue } from "@/types/validation";
import type { NodeRunStatus } from "@/types/run";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/store/uiStore";

export type BaseNodeProps = {
  nodeId?: string;
  position?: { x: number; y: number };
  label: string;
  category: NodeCategory;
  subcategory?: string;
  nodeKind?: NodeKind;
  accent: string;
  icon: LucideIcon;
  /** One-line summary of the node's current config. */
  summary?: ReactNode;
  /** Extra body content. */
  children?: ReactNode;
  hasInput: boolean;
  /** Handle ids on the output side; ["out"] for everything except conditions/switch. */
  outputs: string[];
  outputSpecs?: readonly HandleSpec[];
  selected?: boolean;
  /** Blocking issues; renders a red ring plus a badge listing them. */
  errors?: ValidationIssue[];
  /** Live execution status, drives the pulse / check / shake / dim states. */
  status?: NodeRunStatus;
  /** For sticky notes (`nodeKind === "annotation"`). */
  stickyContent?: string;
  stickyColor?: string;
};

const STICKY_TINTS: Record<string, string> = {
  amber: "border-amber-500/40 bg-amber-500/10",
  ember: "border-orange-500/40 bg-orange-500/10",
  emerald: "border-emerald-500/40 bg-emerald-500/10",
  stone: "border-border bg-surface-raised",
};

function BaseNodeInner({
  nodeId,
  position,
  label,
  category,
  subcategory,
  nodeKind = "action",
  accent,
  icon: Icon,
  summary,
  children,
  hasInput,
  outputs,
  outputSpecs,
  selected,
  errors,
  status = "idle",
  stickyContent,
  stickyColor = "amber",
}: BaseNodeProps) {
  const isRunning = useUiStore((state) => state.isRunning);
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);
  const setAgentTraceNodeId = useUiStore((state) => state.setAgentTraceNodeId);

  const isSubNode =
    nodeKind === "ai-model" || nodeKind === "ai-memory" || nodeKind === "ai-tool";
  const isAiAgent = nodeKind === "ai-agent";
  const isAnnotation = nodeKind === "annotation";

  // 1. Sticky Note Annotation Card
  if (isAnnotation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: NODE_WIDTH }}
        className={cn(
          "ff-node relative rounded-lg border border-dashed p-3 text-left shadow-sm transition-colors",
          STICKY_TINTS[stickyColor] ?? STICKY_TINTS.amber,
          selected && "ring-2 ring-accent",
        )}
      >
        <div className="mb-1 flex items-center gap-2">
          <Icon className="size-3.5 text-amber-400" aria-hidden />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {label}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
          {stickyContent || "Double-click to edit note in Inspector…"}
        </p>
      </motion.div>
    );
  }

  // 2. Compact AI Sub-Node Card (`ai-model`, `ai-memory`, `ai-tool`)
  if (isSubNode) {
    const subPortId =
      nodeKind === "ai-model"
        ? "ai_model"
        : nodeKind === "ai-memory"
          ? "ai_memory"
          : "ai_tool";
    const subKindBadge =
      nodeKind === "ai-model"
        ? "Chat Model"
        : nodeKind === "ai-memory"
          ? "Memory"
          : "Agent Tool";

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.7 }}
        style={{ ...nodeAccentVars(accent), width: 188 }}
        className={cn(
          "ff-node relative rounded-xl border border-dashed border-border bg-surface-raised px-3 py-2 text-left",
          "shadow-[0_1px_2px_rgb(0_0_0/0.3),0_6px_16px_-10px_rgb(0_0_0/0.5)]",
          selected && "border-solid border-[var(--node-accent)] glow-accent",
          status === "running" && "border-solid border-accent",
          status === "success" && "border-solid border-success/80",
        )}
      >
        <Handle
          id={subPortId}
          type="source"
          position={Position.Top}
          style={{ left: "50%" }}
          aria-label={`${subKindBadge} output for ${label}`}
        />

        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full"
            style={{
              backgroundColor: "rgb(var(--node-accent-rgb) / 0.16)",
              color: "var(--node-accent)",
            }}
          >
            <Icon className="size-3.5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{label}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {subKindBadge}
            </p>
          </div>
          {status === "success" && (
            <Check className="size-3.5 shrink-0 text-success" aria-hidden />
          )}
        </div>
        {summary && (
          <div className="mt-1 border-t border-border/50 pt-1">{summary}</div>
        )}
      </motion.div>
    );
  }

  // 3. Standard Main-Flow Node & AI Agent Node
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.7 }}
      style={{ ...nodeAccentVars(accent), width: NODE_WIDTH }}
      className={cn(
        "ff-node group relative rounded-lg border border-border bg-surface-raised text-left",
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
            {subcategory ? `${CATEGORY_LABEL[category]} · ${subcategory}` : CATEGORY_LABEL[category]}
          </p>
        </div>

        {isAiAgent && nodeId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAgentTraceNodeId(nodeId);
            }}
            title="Open AI Agent Reasoning Trace Drawer"
            className="nodrag rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-2.5" aria-hidden />
              Trace
            </span>
          </button>
        )}
      </header>

      {(summary || children) && (
        <div className="border-t border-border/70 px-3 py-2">
          {summary}
          {children}
        </div>
      )}

      {/* AI Agent Bottom Sub-Node Ports (`ai_model`, `ai_memory`, `ai_tool`) */}
      {isAiAgent && (
        <div className="relative flex items-center justify-between border-t border-border/70 bg-background/40 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                openQuickAdd({
                  targetAgentId: nodeId,
                  targetPortKind: "ai_model",
                  position: position
                    ? { x: position.x - 40, y: position.y + 180 }
                    : undefined,
                });
              }
            }}
            className="nodrag inline-flex items-center gap-1 rounded px-1 py-0.5 text-emerald-400 transition-colors hover:bg-emerald-500/15"
            title="Click to attach a Chat Model sub-node"
          >
            <Plus className="size-2.5" aria-hidden />
            Model*
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                openQuickAdd({
                  targetAgentId: nodeId,
                  targetPortKind: "ai_memory",
                  position: position
                    ? { x: position.x + 60, y: position.y + 180 }
                    : undefined,
                });
              }
            }}
            className="nodrag inline-flex items-center gap-1 rounded px-1 py-0.5 text-teal-400 transition-colors hover:bg-teal-500/15"
            title="Click to attach a Memory sub-node"
          >
            <Plus className="size-2.5" aria-hidden />
            Memory
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                openQuickAdd({
                  targetAgentId: nodeId,
                  targetPortKind: "ai_tool",
                  position: position
                    ? { x: position.x + 170, y: position.y + 180 }
                    : undefined,
                });
              }
            }}
            className="nodrag inline-flex items-center gap-1 rounded px-1 py-0.5 text-amber-400 transition-colors hover:bg-amber-500/15"
            title="Click to attach a Tool sub-node"
          >
            <Plus className="size-2.5" aria-hidden />
            Tools
          </button>

          <Handle
            id="ai_model"
            type="target"
            position={Position.Bottom}
            style={{ left: "22%" }}
            aria-label={`Chat Model port for ${label}`}
          />
          <Handle
            id="ai_memory"
            type="target"
            position={Position.Bottom}
            style={{ left: "50%" }}
            aria-label={`Memory port for ${label}`}
          />
          <Handle
            id="ai_tool"
            type="target"
            position={Position.Bottom}
            style={{ left: "78%" }}
            aria-label={`Tools port for ${label}`}
          />
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

      {outputs.map((handleId, index) => {
        const topPct =
          outputs.length === 1
            ? "50%"
            : `${((index + 1) / (outputs.length + 1)) * 100}%`;
        const handleLabel =
          outputSpecs?.find((s) => s.id === handleId)?.label ?? handleId;
        return (
          <div key={handleId}>
            {outputs.length > 1 && (
              <span
                style={{ top: topPct }}
                className="pointer-events-none absolute right-3 -translate-y-1/2 font-mono text-[9px] text-muted-foreground"
              >
                {handleLabel}
              </span>
            )}
            <Handle
              id={handleId}
              type="source"
              position={Position.Right}
              style={{ top: topPct }}
              aria-label={
                handleId === SOURCE_HANDLE_OUT
                  ? `Output for ${label}`
                  : `${handleId} branch for ${label}`
              }
            />
          </div>
        );
      })}

      {/* Quick-add `+` button on the primary output side when selected or hovered */}
      {outputs.length > 0 && nodeId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openQuickAdd({
              sourceNodeId: nodeId,
              sourceHandle: outputs[0],
              position: position
                ? { x: position.x + NODE_WIDTH + 96, y: position.y }
                : undefined,
            });
          }}
          title="Add & connect next node"
          aria-label={`Add next node after ${label}`}
          className={cn(
            "nodrag absolute top-1/2 -right-6 z-canvas-overlay grid size-4 -translate-y-1/2 place-items-center rounded-full",
            "border border-border bg-surface-raised text-muted-foreground opacity-0 shadow transition-opacity",
            "group-hover:opacity-100 hover:border-accent hover:text-accent",
            selected && "opacity-100",
          )}
        >
          <Plus className="size-2.5" aria-hidden />
        </button>
      )}
    </motion.div>
  );
}

export const BaseNode = memo(BaseNodeInner);
