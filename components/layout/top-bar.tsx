"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Flame, LayoutTemplate, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { SpeedControl } from "@/components/panels/speed-control";
import { WorkflowMenu } from "@/components/panels/workflow-menu";
import { TemplateGallery } from "@/components/panels/template-gallery";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useRunWorkflow } from "@/hooks/use-run-workflow";
import { useRunStore } from "@/store/runStore";
import { useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/**
 * Builder chrome.
 *
 * Held to five controls — brand, name, speed, run, overflow. Delete and Clear used
 * to live here too, but Delete is already on the keyboard and in the inspector, and
 * Clear is a workflow-level action that belongs in the overflow menu. Two separate
 * ways to open Templates was also collapsed into one: the button on wide viewports,
 * the menu entry on narrow ones.
 */
export function TopBar() {
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
  const nodeCount = useWorkflowStore((state) => state.nodes.length);
  const isRunning = useIsRunning();
  const blockingMessage = useRunStore((state) => state.blockingMessage);
  const dismissBlocking = useRunStore((state) => state.setBlockingMessage);

  const { run, cancel } = useRunWorkflow();
  const [editingName, setEditingName] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useKeyboardShortcuts();

  // A blocking message is a reaction to a failed attempt, so it should not linger.
  useEffect(() => {
    if (!blockingMessage) return;
    const timer = setTimeout(() => dismissBlocking(null), 6000);
    return () => clearTimeout(timer);
  }, [blockingMessage, dismissBlocking]);

  return (
    <header className="relative flex h-13 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-4">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-85"
        aria-label="FlowForge home"
      >
        <span className="bg-gradient-ember grid size-7 place-items-center rounded-md text-accent-contrast sm:size-8">
          <Flame className="size-4" aria-hidden strokeWidth={2.4} />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:block">
          FlowForge
        </span>
      </Link>

      <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />

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
          className="h-8 min-w-0 max-w-52 flex-1 rounded-md border border-accent/50 bg-surface-raised px-2 text-sm text-foreground outline-none sm:flex-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label={`Rename workflow, currently ${workflowName}`}
          className="min-w-0 max-w-36 truncate rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-surface-raised sm:max-w-52"
        >
          {workflowName}
        </button>
      )}

      <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums lg:block">
        {nodeCount} node{nodeCount === 1 ? "" : "s"}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
          onClick={() => setTemplatesOpen(true)}
        >
          <LayoutTemplate aria-hidden />
          Templates
        </Button>

        <span className="hidden sm:block">
          <SpeedControl />
        </span>

        {isRunning ? (
          <Button variant="danger" size="sm" onClick={cancel} aria-label="Stop the run">
            <Square aria-hidden />
            <span className="hidden sm:inline">Stop</span>
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
            <span className="hidden sm:inline">Run</span>
          </Button>
        )}

        <WorkflowMenu onOpenTemplates={() => setTemplatesOpen(true)} />

        <ThemeToggle />
      </div>

      <TemplateGallery open={templatesOpen} onOpenChange={setTemplatesOpen} />

      <AnimatePresence>
        {blockingMessage && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
              "absolute top-full left-1/2 z-30 mt-2 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2",
              "items-center gap-2 rounded-lg border border-error/40 bg-surface-raised px-3.5 py-2 shadow-lg",
            )}
          >
            <AlertCircle className="size-4 shrink-0 text-error" aria-hidden />
            <span className="min-w-0 flex-1 text-xs text-foreground">{blockingMessage}</span>
            <button
              type="button"
              onClick={() => dismissBlocking(null)}
              aria-label="Dismiss"
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
