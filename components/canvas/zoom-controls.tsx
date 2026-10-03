"use client";

import { LayoutGrid, Maximize, Minus, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { autoLayout } from "@/lib/layout";
import { useWorkflowStore } from "@/store/workflowStore";
import { useUiStore } from "@/store/uiStore";

/**
 * Custom zoom controls, replacing React Flow's <Controls> so they match the theme
 * and expose a readable zoom percentage.
 */
export function ZoomControls({ className }: { className?: string }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const isRunning = useUiStore((state) => state.isRunning);

  const canLayout = nodes.length > 0 && !isRunning;

  // Re-run the same algorithm the templates use, then frame the result.
  const handleAutoLayout = () => {
    if (!canLayout) return;
    replaceGraph(autoLayout(nodes, edges).nodes, edges);
    window.requestAnimationFrame(() => fitView({ duration: 280, padding: 0.2 }));
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  const buttons = [
    {
      label: "Zoom out",
      icon: Minus,
      action: () => zoomOut({ duration: 180 }),
    },
    {
      label: "Zoom in",
      icon: Plus,
      action: () => zoomIn({ duration: 180 }),
    },
  ];

  return (
    <div
      role="group"
      aria-label="Canvas zoom controls"
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-lg backdrop-blur",
        className,
      )}
    >
      {buttons.map(({ label, icon: Icon, action }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={action}
              aria-label={label}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground active:bg-border"
            >
              <Icon className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}

      <span
        aria-live="off"
        className="min-w-[3.25rem] px-1 text-center font-mono text-[11px] text-muted-foreground tabular-nums"
      >
        {zoomLabel}
      </span>

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleAutoLayout}
            disabled={!canLayout}
            aria-label="Auto-layout, left to right"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground active:bg-border disabled:pointer-events-none disabled:opacity-40"
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Auto-layout (left to right)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => fitView({ duration: 280, padding: 0.2 })}
            aria-label="Fit flow to view"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground active:bg-border"
          >
            <Maximize className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Fit to view</TooltipContent>
      </Tooltip>
    </div>
  );
}
