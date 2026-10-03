"use client";

import { motion } from "framer-motion";
import { LayoutTemplate, MousePointerClick, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewportTier } from "@/hooks/use-viewport-tier";
import { useUiStore } from "@/store/uiStore";

/**
 * Empty state — the canvas should never be a blank rectangle.
 *
 * The instructions differ by viewport because the gestures do: there is no palette
 * on the left to drag from on a phone, and no keyboard to press Enter on.
 */
export function EmptyCanvas() {
  const tier = useViewportTier();
  const compact = tier === "compact";
  const setTemplatesOpen = useUiStore((state) => state.setTemplatesOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0 z-canvas-overlay grid place-items-center px-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-dashed border-border bg-surface/80 px-5 py-6 text-center backdrop-blur-sm sm:px-8 sm:py-7">
        <span className="mx-auto grid size-11 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
          <Workflow className="size-5" aria-hidden />
        </span>

        <h2 className="mt-4 text-base font-semibold text-foreground">Start with a trigger</h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {compact
            ? "Tap Nodes below to add your first node, then pull from its right edge to the next node’s left edge to connect them."
            : "Drag a node from the palette on the left, then pull from its right edge to the next node’s left edge to connect them."}
        </p>

        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <MousePointerClick className="size-3" aria-hidden />
          {compact ? "or start from a template" : "keyboard: Enter adds the focused node"}
        </p>

        {/* Only this button re-enables pointer events. The surrounding card stays
            click-through so dragging over it still pans the canvas. */}
        <Button
          size="sm"
          className="pointer-events-auto mt-5 w-full"
          onClick={() => setTemplatesOpen(true)}
        >
          <LayoutTemplate aria-hidden />
          Browse templates
        </Button>
      </div>
    </motion.div>
  );
}
