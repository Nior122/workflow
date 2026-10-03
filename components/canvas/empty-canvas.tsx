"use client";

import { motion } from "framer-motion";
import { MousePointerClick, Workflow } from "lucide-react";

/** Empty state: the canvas should never be a blank rectangle. */
export function EmptyCanvas() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
    >
      <div className="max-w-sm rounded-xl border border-dashed border-border bg-surface/70 px-8 py-7 text-center backdrop-blur-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
          <Workflow className="size-5" aria-hidden />
        </span>

        <h2 className="mt-4 text-base font-semibold text-foreground">
          Start with a trigger
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Drag a node from the palette on the left, then pull from its right edge to
          the next node&rsquo;s left edge to connect them.
        </p>

        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <MousePointerClick className="size-3" aria-hidden />
          keyboard: Enter adds the focused node
        </p>
      </div>
    </motion.div>
  );
}
