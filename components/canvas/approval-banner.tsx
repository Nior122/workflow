"use client";

import { motion } from "framer-motion";
import { Check, ShieldQuestion, X } from "lucide-react";
import { useUiStore } from "@/store/uiStore";

/**
 * Interactive "Wait for Human Approval" gate.
 *
 * When a `logic.waitForApproval` node executes during a live run, the engine calls
 * `effects.requestApproval`, which parks a resolver here. Approve continues the run
 * (delivering the node's output downstream); Reject fails the step, which the normal
 * error path reports in the console.
 */
export function ApprovalBanner() {
  const prompt = useUiStore((state) => state.approvalPrompt);
  const setApprovalPrompt = useUiStore((state) => state.setApprovalPrompt);

  if (!prompt) return null;

  const resolve = (approved: boolean) => {
    prompt.resolve(approved);
    setApprovalPrompt(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      role="alertdialog"
      aria-label="Human approval required"
      className="absolute top-4 left-1/2 z-canvas-toast w-[26rem] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-amber-500/50 bg-surface p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-400"
        >
          <ShieldQuestion className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-amber-400 uppercase">
            Human approval required
          </p>
          <p className="mt-1 text-sm leading-snug text-foreground">{prompt.summary}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {prompt.nodeLabel} · {prompt.nodeId}
            {typeof prompt.details?.approverRole === "string"
              ? ` · approver: ${prompt.details.approverRole}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => resolve(false)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-error/50 hover:text-error"
        >
          <X className="size-3.5" aria-hidden />
          Reject
        </button>
        <button
          type="button"
          onClick={() => resolve(true)}
          className="inline-flex items-center gap-1 rounded-md bg-gradient-ember px-3 py-2 text-xs font-medium text-accent-contrast"
        >
          <Check className="size-3.5" aria-hidden strokeWidth={3} />
          Approve
        </button>
      </div>
    </motion.div>
  );
}
