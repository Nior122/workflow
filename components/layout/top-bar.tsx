"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/**
 * Builder chrome: brand, workflow name, and the run controls.
 *
 * The Run button is present but inert in Phase 1 — the execution engine lands in
 * Phase 3, and it is disabled with an explanatory tooltip rather than hidden, so
 * the layout does not shift when it becomes live.
 */
export function TopBar() {
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
  const deleteSelection = useWorkflowStore((state) => state.deleteSelection);
  const clear = useWorkflowStore((state) => state.clear);
  const nodeCount = useWorkflowStore((state) => state.nodes.length);
  const isRunning = useIsRunning();

  const [editingName, setEditingName] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
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
          className={cn(
            "max-w-52 truncate rounded-md px-2 py-1 text-sm text-foreground",
            "transition-colors hover:bg-surface-raised",
          )}
        >
          {workflowName}
        </button>
      )}

      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {nodeCount} node{nodeCount === 1 ? "" : "s"}
      </span>

      <div className="ml-auto flex items-center gap-2">
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

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled aria-label="Run workflow (unavailable)">
                <Play aria-hidden />
                Run
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Runs arrive in Phase 3 with the execution engine</TooltipContent>
        </Tooltip>

        <ThemeToggle />
      </div>
    </header>
  );
}
