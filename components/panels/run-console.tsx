"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleDashed,
  Copy,
  MinusCircle,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNodeUi } from "@/components/nodes/registry";
import { useRunStore, useRunStatus } from "@/store/runStore";
import { statusLabel, type NodeRunStatus, type StepLog } from "@/types/run";
import { formatJson, type JsonValue } from "@/types/json";

const STATUS_ICON: Record<NodeRunStatus, typeof Check> = {
  idle: CircleDashed,
  queued: CircleDashed,
  running: CircleDashed,
  success: Check,
  error: AlertCircle,
  skipped: MinusCircle,
};

const STATUS_CLASS: Record<NodeRunStatus, string> = {
  idle: "text-muted-foreground",
  queued: "text-muted-foreground",
  running: "text-accent",
  success: "text-success",
  error: "text-error",
  skipped: "text-skipped",
};

/**
 * Bottom console: one timestamped row per step, each expandable to the exact JSON
 * that went in and came out.
 */
export function RunConsole() {
  const steps = useRunStore((state) => state.steps);
  const status = useRunStatus();
  const expanded = useRunStore((state) => state.expandedSteps);
  const toggleStep = useRunStore((state) => state.toggleStep);
  const collapseAll = useRunStore((state) => state.collapseAllSteps);
  const history = useRunStore((state) => state.history);

  const latest = history[0];
  const rows = steps.length > 0 ? steps : (latest?.steps ?? []);
  const source = steps.length > 0 ? "current" : latest ? "previous" : null;

  return (
    <section
      aria-label="Run console"
      className="flex h-full min-h-0 flex-col border-t border-border bg-surface"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Terminal className="size-3.5 text-muted-foreground" aria-hidden />
        <h2 className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Run console
        </h2>

        <RunStatusBadge status={status} />

        {latest && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {latest.durationMs} ms · {latest.steps.length} step
            {latest.steps.length === 1 ? "" : "s"}
            {source === "previous" && " · last run"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {expanded.length > 0 && (
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyConsole status={status} />
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((step) => (
              <StepRow
                key={step.stepId}
                step={step}
                expanded={expanded.includes(step.stepId)}
                onToggle={() => toggleStep(step.stepId)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === "idle") return null;

  const tone =
    status === "completed"
      ? "border-success/35 bg-success/10 text-success"
      : status === "failed"
        ? "border-error/35 bg-error/10 text-error"
        : status === "cancelled"
          ? "border-warning/35 bg-warning/10 text-warning"
          : "border-accent/35 bg-accent/10 text-accent";

  return (
    <span
      role="status"
      className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", tone)}
    >
      {status}
    </span>
  );
}

function EmptyConsole({ status }: { status: string }) {
  const running = status === "running";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      {running ? (
        <>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            className="size-4 rounded-full border-2 border-accent border-t-transparent"
            aria-hidden
          />
          <p className="text-xs text-muted-foreground">Running…</p>
        </>
      ) : (
        <>
          <Terminal className="size-4 text-muted-foreground/60" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Press <span className="font-medium text-foreground">Run</span> to execute the flow.
            Every step&rsquo;s JSON input and output appears here.
          </p>
        </>
      )}
    </div>
  );
}

function StepRow({
  step,
  expanded,
  onToggle,
}: {
  step: StepLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ui = getNodeUi(step.nodeType);
  const Icon = STATUS_ICON[step.status];
  const NodeIcon = ui.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-raised"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden
        />

        <Icon className={cn("size-3.5 shrink-0", STATUS_CLASS[step.status])} aria-hidden />

        <NodeIcon
          className="size-3.5 shrink-0"
          style={{ color: ui.accent }}
          aria-hidden
        />

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {step.nodeLabel}
        </span>

        {step.meta?.matched !== undefined && (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 font-mono text-[10px]",
              step.meta.matched
                ? "border-success/35 bg-success/10 text-success"
                : "border-error/35 bg-error/10 text-error",
            )}
          >
            {String(step.meta.matched)}
          </span>
        )}

        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
          {new Date(step.startedAt).toLocaleTimeString([], {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>

        <span
          className={cn(
            "w-16 shrink-0 text-right font-mono text-[10px] tabular-nums",
            STATUS_CLASS[step.status],
          )}
        >
          {step.status === "skipped" ? statusLabel(step.status).toLowerCase() : `${step.durationMs}ms`}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border/60 bg-background/50 px-4 py-3">
              {step.error && (
                <p
                  role="alert"
                  className="rounded-md border border-error/35 bg-error/10 px-3 py-2 text-xs text-error"
                >
                  <span className="font-mono">{step.error.code}</span> — {step.error.message}
                </p>
              )}

              <JsonBlock label="Input" value={step.input} />

              {step.output !== null && <JsonBlock label="Output" value={step.output} />}

              {step.meta && Object.keys(step.meta).length > 0 && (
                <JsonBlock label="Meta" value={step.meta} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function JsonBlock({ label, value }: { label: string; value: JsonValue }) {
  const [copied, setCopied] = useState(false);
  const text = formatJson(value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Copy ${label.toLowerCase()} JSON`}
        >
          <Copy className="size-2.5" aria-hidden />
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}
