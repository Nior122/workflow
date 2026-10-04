"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CornerDownLeft, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRegistryNode, searchRegistryNodes } from "@/lib/nodes";
import { getNodeUi } from "@/components/nodes/registry";
import { listAllNodeDefs } from "@/lib/engine/registry";
import { useWorkflowStore } from "@/store/workflowStore";
import { useUiStore } from "@/store/uiStore";
import type { NodeType } from "@/types/nodes";

const PORT_LABEL: Record<string, string> = {
  ai_model: "Chat Model sub-node",
  ai_memory: "Memory sub-node",
  ai_tool: "Tool sub-node",
};

/**
 * Quick-add command popup.
 *
 * Opens on canvas double-click or when a node's `+` output handle is clicked. Picking
 * a result places the node and, when the popup was opened from a port, auto-wires the
 * connection — including AI Agent bottom ports (`ai_model`, `ai_memory`, `ai_tool`).
 */
export function QuickAddPopover() {
  const quickAdd = useUiStore((state) => state.quickAdd);

  if (!quickAdd.open) return null;

  // Remounting on every open (keyed by the store's per-open token) is what resets
  // the query and selection — no reset effect, no stale search on the second open.
  return <QuickAddPicker key={quickAdd.token} />;
}

function QuickAddPicker() {
  const quickAdd = useUiStore((state) => state.quickAdd);
  const closeQuickAdd = useUiStore((state) => state.closeQuickAdd);
  const recordRecentNode = useUiStore((state) => state.recordRecentNode);
  const quickAddNode = useWorkflowStore((state) => state.quickAddNode);

  const [query, setQuery] = useState("");
  const [rawActiveIndex, setRawActiveIndex] = useState(0);

  const results = useMemo(() => {
    const allowed = quickAdd.targetPortKind
      ? quickAdd.targetPortKind === "ai_model"
        ? "aiModel."
        : quickAdd.targetPortKind === "ai_memory"
          ? "aiMemory."
          : "aiTool."
      : null;

    const defs = listAllNodeDefs()
      .filter((def) => (allowed ? def.type.startsWith(allowed) : true))
      .filter((def) => !def.type.startsWith("aiModel.") &&
        !def.type.startsWith("aiMemory.") &&
        !def.type.startsWith("aiTool.") || Boolean(allowed));

    if (!query.trim()) return defs.slice(0, 40);

    const matchedIds = new Set(searchRegistryNodes(query).map((n) => n.id));
    return defs
      .filter((def) => matchedIds.has(def.type) || def.type.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 40);
  }, [query, quickAdd.targetPortKind]);

  // Clamp while rendering instead of in an effect: a shorter result list must never
  // leave the highlight pointing past the end.
  const activeIndex = results.length === 0 ? 0 : Math.min(rawActiveIndex, results.length - 1);

  const commit = (type: NodeType) => {
    const position = quickAdd.position ?? { x: 240, y: 200 };
    const connect = quickAdd.sourceNodeId
      ? {
          sourceNodeId: quickAdd.sourceNodeId,
          sourceHandle: quickAdd.sourceHandle ?? "out",
        }
      : quickAdd.targetAgentId
        ? {
            targetNodeId: quickAdd.targetAgentId,
            targetHandle: quickAdd.targetPortKind ?? "in",
          }
        : undefined;

    quickAddNode(type, position, connect);
    recordRecentNode(type);
    closeQuickAdd();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeQuickAdd();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setRawActiveIndex(results.length === 0 ? 0 : (activeIndex + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setRawActiveIndex(
        results.length === 0 ? 0 : (activeIndex - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[activeIndex];
      if (picked) commit(picked.type as NodeType);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-menu">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        role="dialog"
        aria-label="Quick add node"
        className={cn(
          "pointer-events-auto absolute top-24 left-1/2 w-[22rem] -translate-x-1/2",
          "rounded-lg border border-border bg-surface shadow-2xl",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            // Focus on mount so the caret lands in the field the moment the popup
            // appears. A ref callback avoids both an effect and `autoFocus`.
            ref={(element) => element?.focus()}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              quickAdd.targetPortKind
                ? `Pick a ${PORT_LABEL[quickAdd.targetPortKind]}…`
                : "Search nodes to add…"
            }
            aria-label="Search nodes to add"
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <ul className="ff-scroll max-h-72 overflow-y-auto p-1">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No node matches “{query.trim()}”.
            </li>
          )}
          {results.map((def, index) => {
            const ui = getNodeUi(def.type);
            const reg = getRegistryNode(def.type);
            const Icon = ui.icon;
            return (
              <li key={def.type}>
                <button
                  type="button"
                  onMouseEnter={() => setRawActiveIndex(index)}
                  onClick={() => commit(def.type as NodeType)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                    index === activeIndex ? "bg-surface-raised" : "hover:bg-surface-raised",
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded"
                    style={{ color: ui.accent, backgroundColor: `${ui.accent}1f` }}
                  >
                    <Icon className="size-3.5" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {reg?.label ?? def.title}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {def.type}
                    </span>
                  </span>
                  {index === activeIndex ? (
                    <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Plus className="size-3 shrink-0 text-muted-foreground/40" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}
