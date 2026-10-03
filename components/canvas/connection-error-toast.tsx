"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/workflowStore";
import { useViewportTier } from "@/hooks/use-viewport-tier";

/**
 * Shown when a connection is rejected, so the reason is never silent.
 *
 * Lifted out of the palette: it is canvas feedback, and on a narrow viewport it
 * has to clear the bottom dock rather than hide behind it.
 */
export function ConnectionErrorToast() {
  const message = useWorkflowStore((state) => state.lastConnectionError);
  const dismiss = useWorkflowStore((state) => state.dismissConnectionError);
  const tier = useViewportTier();

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={cn(
            "pointer-events-auto absolute left-1/2 z-20 flex w-[min(26rem,calc(100%-2rem))] -translate-x-1/2",
            "items-center gap-2 rounded-lg border border-error/40 bg-surface-raised px-3.5 py-2 shadow-lg",
            tier === "compact" ? "bottom-24" : "bottom-5",
          )}
        >
          <AlertCircle className="size-4 shrink-0 text-error" aria-hidden />
          <span className="min-w-0 flex-1 text-xs text-foreground">{message}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
