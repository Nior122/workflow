"use client";

import { Maximize, Minus, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Custom zoom controls, replacing React Flow's <Controls> so they match the theme
 * and expose a readable zoom percentage.
 */
export function ZoomControls({ className }: { className?: string }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

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
        "flex items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-1 shadow-lg backdrop-blur",
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
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
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

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => fitView({ duration: 280, padding: 0.2 })}
            aria-label="Fit flow to view"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <Maximize className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Fit to view</TooltipContent>
      </Tooltip>
    </div>
  );
}
