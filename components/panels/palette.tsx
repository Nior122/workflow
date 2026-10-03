"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_DRAG_TYPE } from "@/config/constants";
import { CATEGORY_LABEL } from "@/config/theme";
import { listNodeDefs, type AnyNodeTypeDef } from "@/lib/engine/registry";
import { getNodeUi } from "@/components/nodes/registry";
import { useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning } from "@/store/uiStore";
import type { NodeCategory, NodeType } from "@/types/nodes";

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "action", "output"];

/**
 * Left-hand palette.
 *
 * Items are real <button>s, so the palette is fully keyboard-operable: Enter or
 * Space adds the node to the centre of the current viewport. Drag-and-drop is a
 * progressive enhancement on top of that, not the only path.
 */
export function Palette({ onAddAtViewportCenter }: { onAddAtViewportCenter: () => { x: number; y: number } }) {
  const addNode = useWorkflowStore((state) => state.addNode);
  const isRunning = useIsRunning();
  const [addedType, setAddedType] = useState<NodeType | null>(null);

  const handleAdd = useCallback(
    (type: NodeType) => {
      if (isRunning) return;
      const position = onAddAtViewportCenter();
      const id = addNode(type, position);
      if (id) {
        setAddedType(type);
        window.setTimeout(() => setAddedType((current) => (current === type ? null : current)), 900);
      }
    },
    [addNode, isRunning, onAddAtViewportCenter],
  );

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    defs: listNodeDefs().filter((def) => def.category === category),
  })).filter((group) => group.defs.length > 0);

  return (
    <nav
      aria-label="Node palette"
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface",
        isRunning && "pointer-events-none opacity-60",
      )}
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Nodes</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag onto the canvas, or focus and press Enter.
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {grouped.map(({ category, defs }) => (
          <section key={category} aria-labelledby={`palette-${category}`}>
            <h3
              id={`palette-${category}`}
              className="px-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {CATEGORY_LABEL[category]}s
            </h3>

            <ul className="space-y-1.5">
              {defs.map((def) => (
                <li key={def.type}>
                  <PaletteItem
                    def={def}
                    disabled={isRunning}
                    justAdded={addedType === def.type}
                    onAdd={handleAdd}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        {listNodeDefs().length} node types available
      </footer>
    </nav>
  );
}

type PaletteItemProps = {
  def: AnyNodeTypeDef;
  disabled: boolean;
  justAdded: boolean;
  onAdd: (type: NodeType) => void;
};

function PaletteItem({ def, disabled, justAdded, onAdd }: PaletteItemProps) {
  const ui = getNodeUi(def.type);
  const Icon = ui.icon;

  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(NODE_DRAG_TYPE, def.type);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onAdd(def.type)}
      aria-label={`Add ${def.title} node`}
      className={cn(
        "group relative flex w-full cursor-grab items-start gap-2.5 rounded-md border border-border",
        "bg-surface-raised px-3 py-2.5 text-left transition-all active:cursor-grabbing",
        "hover:border-[color:var(--item-accent)]/60 hover:shadow-[0_0_16px_-6px_var(--item-accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ ["--item-accent" as string]: ui.accent }}
    >
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded border"
        style={{
          borderColor: `${ui.accent}59`,
          backgroundColor: `${ui.accent}24`,
          color: ui.accent,
        }}
      >
        <Icon className="size-3.5" strokeWidth={2.2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {def.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
          {def.description}
        </span>
      </span>

      <GripVertical
        aria-hidden
        className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
      />

      <AnimatePresence>
        {justAdded && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 text-[10px] font-medium text-success"
          >
            added
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Shown when a connection is rejected, so the reason is never silent. */
export function ConnectionErrorToast() {
  const message = useWorkflowStore((state) => state.lastConnectionError);
  const dismiss = useWorkflowStore((state) => state.dismissConnectionError);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-error/40 bg-surface-raised px-3.5 py-2 shadow-lg"
        >
          <AlertCircle className="size-4 shrink-0 text-error" aria-hidden />
          <span className="text-xs text-foreground">{message}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="ml-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
