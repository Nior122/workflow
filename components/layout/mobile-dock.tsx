"use client";

import { useState } from "react";
import { Blocks, Play, SlidersHorizontal, Square, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Palette } from "@/components/panels/palette";
import { InspectorContent } from "@/components/panels/inspector";
import { RunPanelContent } from "@/components/panels/bottom-panel";
import { useAddNodeAtCenter } from "@/hooks/use-canvas-actions";
import { useRunWorkflow } from "@/hooks/use-run-workflow";
import { useSelectedNode, useWorkflowStore } from "@/store/workflowStore";
import { useIsRunning, useUiStore } from "@/store/uiStore";

type SheetId = "nodes" | "console" | null;

/**
 * Bottom app bar for narrow viewports.
 *
 * Replaces the three docked panels with four thumb-reachable actions. This is a
 * real editor, not a read-only viewer: the palette sheet adds nodes, the inspector
 * sheet edits config, and the console sheet shows the run.
 */
export function MobileDock() {
  const [open, setOpen] = useState<SheetId>(null);

  const selectedNode = useSelectedNode();
  const nodeCount = useWorkflowStore((state) => state.nodes.length);
  const isRunning = useIsRunning();
  const inspectorOpen = useUiStore((state) => state.inspectorOpen);
  const setPanel = useUiStore((state) => state.setPanel);
  const { run, cancel } = useRunWorkflow();
  const addNodeAtCenter = useAddNodeAtCenter();

  const close = () => setOpen(null);

  const items = [
    {
      id: "nodes" as const,
      label: "Nodes",
      icon: Blocks,
      badge: null,
      disabled: false,
    },
    {
      id: "inspector" as const,
      label: "Inspect",
      icon: SlidersHorizontal,
      // A dot says "something is selected and waiting", without auto-opening a
      // sheet over the canvas mid-drag.
      badge: selectedNode ? "dot" : null,
      disabled: false,
    },
    {
      id: "console" as const,
      label: "Console",
      icon: Terminal,
      badge: null,
      disabled: false,
    },
  ];

  return (
    <>
      <nav
        aria-label="Builder tools"
        className={cn(
          "z-30 flex shrink-0 items-stretch border-t border-border bg-surface",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {items.map(({ id, label, icon: Icon, badge, disabled }) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              id === "inspector"
                ? setPanel("inspector", !inspectorOpen)
                : setOpen((current) => (current === id ? null : id))
            }
            disabled={disabled}
            aria-expanded={id === "inspector" ? inspectorOpen : open === id}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              (id === "inspector" ? inspectorOpen : open === id)
                ? "text-accent"
                : "text-muted-foreground",
              "disabled:opacity-40",
            )}
          >
            <Icon className="size-[18px]" aria-hidden strokeWidth={2} />
            {label}
            {badge === "dot" && (
              <span
                aria-hidden
                className="absolute top-2 right-[calc(50%-14px)] size-1.5 rounded-full bg-accent"
              />
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => (isRunning ? cancel() : void run())}
          disabled={!isRunning && nodeCount === 0}
          aria-label={isRunning ? "Stop the run" : "Run the workflow"}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
            "disabled:opacity-40",
            isRunning ? "text-error" : "text-accent",
          )}
        >
          {isRunning ? (
            <Square className="size-[18px]" aria-hidden strokeWidth={2} />
          ) : (
            <Play className="size-[18px]" aria-hidden strokeWidth={2} />
          )}
          {isRunning ? "Stop" : "Run"}
        </button>
      </nav>

      <Sheet open={open === "nodes"} onOpenChange={(value) => setOpen(value ? "nodes" : null)}>
        <SheetContent title="Add a node" subtitle="Tap to place it in the centre of the canvas.">
          <div className="h-[60dvh]">
            <Palette onAddAtViewportCenter={addNodeAtCenter} onNodeAdded={close} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={inspectorOpen}
        onOpenChange={(value) => setPanel("inspector", value)}
      >
        <SheetContent title="Inspector" subtitle="Rename, configure and test the selected node.">
          <div className="flex h-[60dvh] flex-col">
            <InspectorContent />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={open === "console"} onOpenChange={(value) => setOpen(value ? "console" : null)}>
        <SheetContent title="Run console" subtitle="Every step, with its exact input and output.">
          <div className="flex h-[60dvh] flex-col">
            <RunPanelContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
