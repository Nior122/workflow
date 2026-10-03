"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Flame, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { SpeedControl } from "@/components/panels/speed-control";
import { useRunWorkflow } from "@/hooks/use-run-workflow";
import { useRunStore } from "@/store/runStore";
import { useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/**
 * Builder chrome: brand, workflow name, speed, and run controls.
 */
export function TopBar() {
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
  const deleteSelection = useWorkflowStore((state) => state.deleteSelection);
  const clear = useWorkflowStore((state) => state.clear);
  const nodeCount = useWorkflowStore((state) => state.nodes.length);
  const isRunning = useIsRunning();
  const blockingMessage = useRunStore((state) => state.blockingMessage);
  const dismissBlocking = useRunStore((state) => state.setBlockingMessage);

  const { run, cancel } = useRunWorkflow();
  const [editingName, setEditingName] = useState(false);

  // A blocking message is a reaction to a failed attempt, so it should not linger.
  useEffect(() => {
    if (!blockingMessage) return;
    const timer = setTimeout(() => dismissBlocking(null), 6000);
    return () => clearTimeout(timer);
  }, [blockingMessage, dismissBlocking]);

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md pr-2 transition-opacity hover:opacity-85"
        aria-label="FlowForge home"
      >
        <span className="bg-gradient-ember grid size-8 place-items-center rounded-md text-accent-contrast shadow-sm">
          <Flame className="size-4" aria-hidden strokeWidth={2.4} />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">FlowForge</span>
      </Link>

      <span aria-hidden className="h-5 w-px bg-border" />

      {editingName ? (
        <input
          autoFocus
          defaultValue={workflowName}
          aria-label="Workflow name"
          onBlur={(event) => {
            setWorkflowName(event.target.value);
            setEditingName(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setEditingName(false);
          }}
          className="w-52 rounded-md border border-accent/50 bg-surface-raised px-2 py-1 text-sm text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label={`Rename workflow, currently ${workflowName}`}
          className="max-w-52 truncate rounded-md px-2 py-1 text-sm text-foreground transition-colors hover:bg-surface-raised"
        >
          {workflowName}
        </button>
      )}

      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {nodeCount} node{nodeCount === 1 ? "" : "s"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <SpeedControl />

        <span aria-hidden className="h-5 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="secondary"
                size="sm"
                onClick={deleteSelection}
                disabled={isRunning}
                aria-label="Delete selected nodes"
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Select nodes, then press Delete or Backspace</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                disabled={isRunning || nodeCount === 0}
                aria-label="Clear the canvas"
              >
                Clear
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Remove every node and connection</TooltipContent>
        </Tooltip>

        {isRunning ? (
          <Button variant="danger" size="sm" onClick={cancel} aria-label="Stop the run">
            <Square aria-hidden />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => void run()}
            disabled={nodeCount === 0}
            className="glow-accent"
            aria-label="Run the workflow"
          >
            <Play aria-hidden />
            Run
          </Button>
        )}

        <ThemeToggle />
      </div>

      <AnimatePresence>
        {blockingMessage && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
              "absolute top-full left-1/2 z-30 mt-2 flex -translate-x-1/2 items-center gap-2",
              "rounded-lg border border-error/40 bg-surface-raised px-3.5 py-2 shadow-lg",
            )}
          >
            <AlertCircle className="size-4 shrink-0 text-error" aria-hidden />
            <span className="text-xs text-foreground">{blockingMessage}</span>
            <button
              type="button"
              onClick={() => dismissBlocking(null)}
              aria-label="Dismiss"
              className="ml-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
