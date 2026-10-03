"use client";

import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  Download,
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
import { isWorkflow, type Workflow } from "@/types/workflow";
import type { FlowEdge, FlowNode } from "@/types";

type Toast = { tone: "ok" | "error"; message: string } | null;

/**
 * Workflow actions: new, templates, import/export, share link, undo/redo and
 * auto-layout.
 *
 * Import accepts either a full exported workflow or a bare `{ nodes, edges }`
 * graph, because people hand-edit these files.
 */
export function WorkflowMenu({ onOpenTemplates }: { onOpenTemplates: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const createNewWorkflow = useWorkflowStore((state) => state.createNewWorkflow);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.past.length > 0);
  const canRedo = useWorkflowStore((state) => state.future.length > 0);

  const resetStatuses = useRunStore((state) => state.resetStatuses);
  const isRunning = useUiStore((state) => state.isRunning);

  const flash = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3200);
  };

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

    flash({ tone: "ok", message: "Workflow exported as JSON" });
  };

  const handleImportFile = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      flash({ tone: "error", message: "That file is not valid JSON" });
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
      flash({ tone: "error", message: "No nodes or connections found in that file" });
      return;
    }

    replaceGraph(graphNodes, graphEdges, name);
    resetStatuses();
    flash({ tone: "ok", message: `Imported ${graphNodes.length} nodes` });
  };

  const handleShare = async () => {
    if (nodes.length === 0) {
      flash({ tone: "error", message: "Add some nodes before sharing" });
      return;
    }

    const { url, tooLong } = buildShareUrl({ name: workflowName, nodes, edges });

    try {
      await navigator.clipboard.writeText(url);
      flash({
        tone: "ok",
        message: tooLong
          ? `Copied — but ${url.length} chars may be truncated by some apps`
          : "Share link copied to clipboard",
      });
    } catch {
      flash({ tone: "error", message: "Clipboard blocked — copy the URL manually" });
      window.location.hash = url.slice(url.indexOf("#"));
    }
  };

  const handleAutoLayout = () => {
    if (nodes.length === 0) return;
    const result = autoLayout(nodes, edges);
    replaceGraph(result.nodes, edges);
    flash({ tone: "ok", message: "Arranged left to right" });
  };

  const itemClass = cn(
    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs",
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
            className="grid size-9 place-items-center rounded-md border border-border bg-surface-raised text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:opacity-50"
          >
            <LayoutGrid className="size-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-xl"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => createNewWorkflow()}>
              <FilePlus2 className="size-3.5 text-muted-foreground" aria-hidden />
              New workflow
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={onOpenTemplates}>
              <LayoutTemplate className="size-3.5 text-muted-foreground" aria-hidden />
              Templates…
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

            <DropdownMenu.Item className={itemClass} onSelect={handleAutoLayout} disabled={nodes.length === 0}>
              <LayoutGrid className="size-3.5 text-muted-foreground" aria-hidden />
              Auto-layout
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={undo} disabled={!canUndo}>
              <Undo2 className="size-3.5 text-muted-foreground" aria-hidden />
              Undo
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘Z</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item className={itemClass} onSelect={redo} disabled={!canRedo}>
              <Redo2 className="size-3.5 text-muted-foreground" aria-hidden />
              Redo
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">⇧⌘Z</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

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

      {toast && (
        <div
          role="status"
          className={cn(
            "absolute top-full right-0 z-40 mt-2 flex w-64 items-start gap-2 rounded-lg border px-3 py-2 shadow-lg",
            toast.tone === "ok"
              ? "border-success/40 bg-surface-raised"
              : "border-error/40 bg-surface-raised",
          )}
        >
          <Check
            className={cn(
              "mt-px size-3.5 shrink-0",
              toast.tone === "ok" ? "text-success" : "text-error",
            )}
            aria-hidden
          />
          <span className="text-xs text-foreground">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
