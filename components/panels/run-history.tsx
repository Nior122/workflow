"use client";

import { motion } from "framer-motion";
import { Check, Clock, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRunHistory, useRunStore } from "@/store/runStore";
import type { RunResult } from "@/types/run";

const STATUS_META: Record<
  RunResult["status"],
  { label: string; className: string; icon: typeof Check }
> = {
  idle: { label: "Idle", className: "text-muted-foreground", icon: Clock },
  validating: { label: "Validating", className: "text-muted-foreground", icon: Clock },
  running: { label: "Running", className: "text-accent", icon: Clock },
  completed: { label: "Completed", className: "text-success", icon: Check },
  failed: { label: "Failed", className: "text-error", icon: XCircle },
  cancelled: { label: "Cancelled", className: "text-warning", icon: XCircle },
};

/** Last ten runs with status and duration. */
export function RunHistory() {
  const history = useRunHistory();
  const clearHistory = useRunStore((state) => state.clearHistory);

  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
        <Clock className="size-4 text-muted-foreground/60" aria-hidden />
        <p className="text-xs text-muted-foreground">
          No runs yet. The last ten runs are kept here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">
          {history.length} run{history.length === 1 ? "" : "s"} kept
        </span>
        <Button variant="ghost" size="sm" onClick={clearHistory} aria-label="Clear run history">
          <Trash2 aria-hidden />
          Clear
        </Button>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        {history.map((run, index) => {
          const meta = STATUS_META[run.status];
          const Icon = meta.icon;
          const succeeded = run.steps.filter((step) => step.status === "success").length;
          const skipped = run.steps.filter((step) => step.status === "skipped").length;

          return (
            <motion.li
              key={run.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 px-4 py-2"
            >
              <Icon className={cn("size-3.5 shrink-0", meta.className)} aria-hidden />

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {index === 0 ? "Most recent" : `Run ${history.length - index}`}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {run.workflowName}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {succeeded} ok{skipped > 0 ? ` · ${skipped} skipped` : ""} ·{" "}
                  {new Date(run.startedAt).toLocaleTimeString([], { hour12: false })}
                </p>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                  meta.className,
                  run.status === "completed"
                    ? "border-success/35 bg-success/10"
                    : run.status === "failed"
                      ? "border-error/35 bg-error/10"
                      : "border-border bg-surface-raised",
                )}
              >
                {meta.label}
              </span>

              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                {run.durationMs}ms
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
