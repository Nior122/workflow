"use client";

import { useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  Download,
  Eraser,
  FilePlus2,
  LayoutTemplate,
  LayoutGrid,
  Redo2,
  Share2,
  Upload,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { autoLayout } from "@/lib/layout";
import { buildShareUrl } from "@/lib/utils/share";
import { useWorkflowStore } from "@/store/workflowStore";
import { useRunStore } from "@/store/runStore";
import { useUiStore } from "@/store/uiStore";
import { pushToast } from "@/store/toastStore";
import { Kbd } from "@/components/ui/kbd";
import { EXECUTION_SPEEDS } from "@/config/constants";
import type { ExecutionSpeed } from "@/types/run";
import { isWorkflow, type Workflow } from "@/types/workflow";
import type { FlowEdge, FlowNode } from "@/types";

/**
 * Workflow actions: new, templates, import/export, share link, undo/redo and
 * auto-layout.
 *
 * Import accepts either a full exported workflow or a bare `{ nodes, edges }`
 * graph, because people hand-edit these files.
 */
export function WorkflowMenu({ onOpenTemplates }: { onOpenTemplates: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const createNewWorkflow = useWorkflowStore((state) => state.createNewWorkflow);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.past.length > 0);
  const canRedo = useWorkflowStore((state) => state.future.length > 0);
  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflowId = useWorkflowStore((state) => state.activeWorkflowId);
  const switchWorkflow = useWorkflowStore((state) => state.switchWorkflow);
  const clear = useWorkflowStore((state) => state.clear);

  const resetStatuses = useRunStore((state) => state.resetStatuses);
  const isRunning = useUiStore((state) => state.isRunning);
  const speed = useUiStore((state) => state.speed);
  const setSpeed = useUiStore((state) => state.setSpeed);

  const handleExport = () => {
    const workflow: Workflow = {
      id: "exported",
      name: workflowName,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes,
      edges,
      viewport: useWorkflowStore.getState().viewport,
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflowName.replace(/[^\w-]+/g, "-").toLowerCase() || "workflow"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    pushToast("ok", "Workflow exported as JSON");
  };

  const handleImportFile = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      pushToast("error", "That file is not valid JSON");
      return;
    }

    let graphNodes: FlowNode[] | undefined;
    let graphEdges: FlowEdge[] | undefined;
    let name = file.name.replace(/\.json$/i, "");

    if (isWorkflow(parsed)) {
      graphNodes = parsed.nodes;
      graphEdges = parsed.edges;
      name = parsed.name || name;
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { nodes?: unknown }).nodes) &&
      Array.isArray((parsed as { edges?: unknown }).edges)
    ) {
      const bare = parsed as { nodes: FlowNode[]; edges: FlowEdge[] };
      graphNodes = bare.nodes;
      graphEdges = bare.edges;
    }

    if (!graphNodes || !graphEdges) {
      pushToast("error", "No nodes or connections found in that file");
      return;
    }

    replaceGraph(graphNodes, graphEdges, name);
    resetStatuses();
    pushToast("ok", `Imported ${graphNodes.length} nodes`);
  };

  const handleShare = async () => {
    if (nodes.length === 0) {
      pushToast("error", "Add some nodes before sharing");
      return;
    }

    const { url, tooLong } = buildShareUrl({ name: workflowName, nodes, edges });

    try {
      await navigator.clipboard.writeText(url);
      pushToast(
        "ok",
        tooLong
          ? `Copied — but ${url.length} chars may be truncated by some apps`
          : "Share link copied to clipboard",
      );
    } catch {
      pushToast("error", "Clipboard blocked — copy the URL manually");
      window.location.hash = url.slice(url.indexOf("#"));
    }
  };

  const handleAutoLayout = () => {
    if (nodes.length === 0) return;
    const result = autoLayout(nodes, edges);
    replaceGraph(result.nodes, edges);
    pushToast("ok", "Arranged left to right");
  };

  const itemClass = cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-xs",
    "text-foreground outline-none transition-colors",
    "data-[highlighted]:bg-surface-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  );

  return (
    <div className="relative">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={isRunning}
            aria-label="Workflow actions"
            className="grid size-9 place-items-center rounded-md border border-border bg-surface-raised text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground active:bg-border disabled:opacity-50"
          >
            <LayoutGrid className="size-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-overlay w-56 rounded-lg border border-border bg-surface p-2 shadow-xl"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => createNewWorkflow()}>
              <FilePlus2 className="size-3.5 text-muted-foreground" aria-hidden />
              New workflow
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={onOpenTemplates}>
              <LayoutTemplate className="size-3.5 text-muted-foreground" aria-hidden />
              Templates…
            </DropdownMenu.Item>

            {workflows.length > 1 && (
              <>
                <DropdownMenu.Separator className="my-2 h-px bg-border" />
                <DropdownMenu.Label className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Switch to
                </DropdownMenu.Label>
                {workflows.map((workflow) => (
                  <DropdownMenu.Item
                    key={workflow.id}
                    className={itemClass}
                    disabled={workflow.id === activeWorkflowId}
                    onSelect={() => switchWorkflow(workflow.id)}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        workflow.id === activeWorkflowId
                          ? "text-accent"
                          : "text-transparent",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{workflow.name}</span>
                  </DropdownMenu.Item>
                ))}
              </>
            )}

            <DropdownMenu.Separator className="my-2 h-px bg-border" />

            <DropdownMenu.Item className={itemClass} onSelect={handleAutoLayout} disabled={nodes.length === 0}>
              <LayoutGrid className="size-3.5 text-muted-foreground" aria-hidden />
              Auto-layout
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={undo} disabled={!canUndo}>
              <Undo2 className="size-3.5 text-muted-foreground" aria-hidden />
              Undo
              <Kbd mod keys={["Z"]} className="ml-auto" />
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘Z</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={redo} disabled={!canRedo}>
              <Redo2 className="size-3.5 text-muted-foreground" aria-hidden />
              Redo
              <Kbd mod keys={["⇧", "Z"]} className="ml-auto" />
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">⇧⌘Z</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-2 h-px bg-border sm:hidden" />

            {/* Narrow viewports hide the inline speed control, so it lives here.
                The two never render at the same width. */}
            <div className="sm:hidden">
              <DropdownMenu.Label className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Execution speed
              </DropdownMenu.Label>
              {EXECUTION_SPEEDS.map((option) => (
                <DropdownMenu.Item
                  key={option}
                  className={itemClass}
                  disabled={isRunning || speed === option}
                  onSelect={() => setSpeed(option as ExecutionSpeed)}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      speed === option ? "text-accent" : "text-transparent",
                    )}
                    aria-hidden
                  />
                  <span className="font-mono text-[11px]">{option}×</span>
                </DropdownMenu.Item>
              ))}
            </div>

            <DropdownMenu.Separator className="my-2 h-px bg-border" />

            <DropdownMenu.Item
              className={cn(itemClass, "text-error data-[highlighted]:text-error")}
              onSelect={clear}
              disabled={nodes.length === 0}
            >
              <Eraser className="size-3.5" aria-hidden />
              Clear canvas
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-2 h-px bg-border" />

            <DropdownMenu.Item
              className={itemClass}
              onSelect={() => fileInput.current?.click()}
            >
              <Upload className="size-3.5 text-muted-foreground" aria-hidden />
              Import JSON…
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={handleExport} disabled={nodes.length === 0}>
              <Download className="size-3.5 text-muted-foreground" aria-hidden />
              Export JSON
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={handleShare}>
              <Share2 className="size-3.5 text-muted-foreground" aria-hidden />
              Copy share link
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import a workflow JSON file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
          event.target.value = "";
        }}
      />

    </div>
  );
}
