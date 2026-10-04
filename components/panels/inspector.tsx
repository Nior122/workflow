"use client";

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Copy,
  MousePointerClick,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CONFIG_FORMS } from "@/components/nodes/forms";
import { SchemaNodeForm } from "@/components/nodes/forms/schema-form";
import { getNodeUi } from "@/components/nodes/registry";
import { requireNodeDef } from "@/lib/engine/registry";
import { getRegistryNode } from "@/lib/nodes";
import { useSelectedNode, useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning, useUiStore } from "@/store/uiStore";
import { CATEGORY_LABEL } from "@/config/theme";
import type { CoreNodeType, FlowNode, NodeConfig, NodeType } from "@/types/nodes";

export function InspectorContent() {
  const node = useSelectedNode();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {node ? (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <InspectorBody node={node} />
        </motion.div>
      ) : (
        <EmptyInspector key="empty" />
      )}
    </AnimatePresence>
  );
}

export function Inspector({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Node inspector"
      className={cn(
        "flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface",
        className,
      )}
    >
      <InspectorContent />
    </aside>
  );
}

function InspectorBody({ node }: { node: FlowNode }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const renameNode = useWorkflowStore((state) => state.renameNode);
  const deleteSelection = useWorkflowStore((state) => state.deleteSelection);
  const setAgentTraceNodeId = useUiStore((state) => state.setAgentTraceNodeId);
  const isRunning = useIsRunning();

  const type = node.type as NodeType;
  const ui = getNodeUi(type);
  const def = requireNodeDef(type);
  const regNode = getRegistryNode(type);
  const Icon = ui.icon;
  const CoreForm = (CONFIG_FORMS as Record<string, (typeof CONFIG_FORMS)[CoreNodeType]>)[
    type
  ];

  const issues = def.validateConfig(node.data.config);
  const errorCount = issues.filter((issue) => issue.level === "error").length;

  const handleConfigChange = useCallback(
    (config: NodeConfig) => updateNodeData(node.id, { config: config as never }),
    [node.id, updateNodeData],
  );

  const handleSchemaPatch = useCallback(
    (patch: Record<string, unknown>) => {
      const current = (node.data.config ?? {}) as Record<string, unknown>;
      updateNodeData(node.id, {
        config: { ...current, ...patch } as never,
      });
    },
    [node.id, node.data.config, updateNodeData],
  );

  return (
    <>
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-md border"
            style={{
              borderColor: `${ui.accent}59`,
              backgroundColor: `${ui.accent}24`,
              color: ui.accent,
            }}
          >
            <Icon className="size-4" strokeWidth={2.2} />
          </span>

          <div className="min-w-0 flex-1">
            <input
              value={node.data.label}
              disabled={isRunning}
              aria-label="Node name"
              onChange={(event) => renameNode(node.id, event.target.value)}
              className="w-full truncate rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-foreground transition-colors hover:border-border focus:border-accent focus:outline-none"
            />
            <p className="mt-1 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABEL[ui.category]} · {regNode?.subcategory ?? def.title}
            </p>
          </div>

          <button
            type="button"
            onClick={deleteSelection}
            disabled={isRunning}
            aria-label="Delete this node"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-error/15 hover:text-error active:bg-error/25 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {def.description}
        </p>

        {type === "action.aiAgent" && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-accent/35 bg-accent/10 px-3 py-2">
            <span className="font-mono text-[11px] text-foreground">
              Connect Model, Memory &amp; Tools on bottom ports
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setAgentTraceNodeId(node.id)}
            >
              <Sparkles className="size-3 text-accent" aria-hidden />
              Trace
            </Button>
          </div>
        )}

        {errorCount > 0 && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-error/35 bg-error/10 px-3 py-2 text-[11px] text-error"
          >
            <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
            {errorCount === 1
              ? "This node has a configuration error."
              : `This node has ${errorCount} configuration errors.`}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {CoreForm ? (
          <CoreForm
            config={node.data.config as never}
            onChange={handleConfigChange}
            disabled={isRunning}
            issues={issues}
          />
        ) : regNode ? (
          <SchemaNodeForm
            nodeId={node.id}
            regNode={regNode}
            config={(node.data.config ?? {}) as Record<string, unknown>}
            issues={issues}
            onChange={handleSchemaPatch}
          />
        ) : null}
      </div>

      {ui.nodeKind !== "annotation" && (
        <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-2 text-xs transition-colors",
                node.data.retryOnFail && "border-amber-500/50 bg-amber-500/10",
                isRunning && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={Boolean(node.data.retryOnFail)}
                disabled={isRunning}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    retryOnFail: e.target.checked,
                    maxRetries: node.data.maxRetries ?? 2,
                  })
                }
                className="size-3.5 cursor-pointer rounded border-border"
              />
              <RotateCw className="size-3 text-amber-400" aria-hidden />
              <span className="truncate font-medium text-foreground">
                Retry on fail
              </span>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-2 text-xs transition-colors",
                node.data.continueOnError && "border-emerald-500/50 bg-emerald-500/10",
                isRunning && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={Boolean(node.data.continueOnError)}
                disabled={isRunning}
                onChange={(e) =>
                  updateNodeData(node.id, { continueOnError: e.target.checked })
                }
                className="size-3.5 cursor-pointer rounded border-border"
              />
              <ShieldAlert className="size-3 text-emerald-400" aria-hidden />
              <span className="truncate font-medium text-foreground">
                Continue on error
              </span>
            </label>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 transition-colors",
              node.data.simulateFailure
                ? "border-error/50 bg-error/10"
                : "hover:border-error/40",
              isRunning && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="checkbox"
              checked={node.data.simulateFailure}
              disabled={isRunning}
              onChange={(event) =>
                updateNodeData(node.id, { simulateFailure: event.target.checked })
              }
              className="mt-1 size-4 cursor-pointer rounded border-border accent-[hsl(var(--error))]"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">
                Simulate failure
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                Forces this node to throw on the next run, to demo error handling.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="font-mono text-[10px] text-muted-foreground">
              id: {node.id}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(node.id);
              }}
              aria-label="Copy node id"
            >
              <Copy aria-hidden />
              Copy id
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}

function EmptyInspector() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center px-6 text-center"
    >
      <span className="grid size-10 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
        <MousePointerClick className="size-4" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">No node selected</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Click a node on the canvas to rename it and edit its configuration.
      </p>
    </motion.div>
  );
}
