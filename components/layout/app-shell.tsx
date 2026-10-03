"use client";

import { useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { PanelLeft, PanelRight } from "lucide-react";
import { TopBar } from "./top-bar";
import { MobileDock } from "./mobile-dock";
import { Palette } from "@/components/panels/palette";
import { Inspector } from "@/components/panels/inspector";
import { BottomPanel } from "@/components/panels/bottom-panel";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { CanvasElementProvider } from "@/components/canvas/canvas-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAddNodeAtCenter } from "@/hooks/use-canvas-actions";
import { useViewportTier } from "@/hooks/use-viewport-tier";
import { useLiveValidation } from "@/hooks/use-live-validation";
import { usePersistence } from "@/hooks/use-persistence";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/**
 * Builder layout.
 *
 * Two tiers, chosen by viewport rather than by device:
 *
 * - **wide** — palette | canvas | inspector, all docked, each collapsible so the
 *   canvas can be given the whole width. At 1024px a permanently docked 256px
 *   palette plus 320px inspector left only ~448px of canvas, which is why the
 *   panels collapse rather than merely hide.
 * - **compact** — full-bleed canvas with a bottom app bar. Every panel becomes a
 *   sheet, so the builder stays fully editable on a phone.
 *
 * ReactFlowProvider sits at this level so both the palette and the mobile dock can
 * ask the flow instance for the visible centre when adding a node.
 */
export function AppShell() {
  const tier = useViewportTier();

  // Hydrates from localStorage or a share link, then auto-saves on change.
  usePersistence();
  const hydration = useUiStore((state) => state.hydration);
  const showMinimap = useUiStore((state) => state.showMinimap);

  // Writes graph-level validation issues onto the nodes that caused them.
  useLiveValidation();

  const storageWarning = hydration === "unavailable" && (
    <p
      role="status"
      className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning"
    >
      Browser storage is unavailable, so this session will not be saved. Export your workflow
      to keep it.
    </p>
  );

  if (tier === "compact") {
    return (
      <TooltipProvider>
        <ReactFlowProvider>
          <CanvasElementProvider>
            <div className="flex h-dvh flex-col overflow-hidden bg-background">
              <TopBar />
              {storageWarning}
              <main className="relative min-h-0 flex-1">
                <FlowCanvas minimapVisible={false} />
              </main>
              <MobileDock />
            </div>
          </CanvasElementProvider>
        </ReactFlowProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <CanvasElementProvider>
          <div className="flex h-dvh flex-col overflow-hidden bg-background">
            <TopBar />
            {storageWarning}

            <div className="flex min-h-0 flex-1">
              <PaletteRail />

              <main className="relative min-w-0 flex-1">
                <FlowCanvas minimapVisible={showMinimap} />
              </main>

              <InspectorRail />
            </div>

            <BottomPanel />
          </div>
        </CanvasElementProvider>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

/** Docked palette, collapsible to a thin rail. */
function PaletteRail() {
  const open = useUiStore((state) => state.paletteOpen);
  const setPanel = useUiStore((state) => state.setPanel);
  const addNodeAtCenter = useAddNodeAtCenter();
  const handleAddAtCenter = useCallback(() => addNodeAtCenter(), [addNodeAtCenter]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setPanel("palette", true)}
        aria-label="Show node palette"
        className={cn(
          "flex w-10 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3",
          "text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        <PanelLeft className="size-4" aria-hidden />
        <span
          className="text-[10px] font-medium tracking-[0.14em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          Nodes
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border">
      <Palette onAddAtViewportCenter={handleAddAtCenter} className="min-h-0 flex-1" />
      <RailToggle
        side="left"
        label="Hide node palette"
        onClick={() => setPanel("palette", false)}
      />
    </div>
  );
}

/** Docked inspector, collapsible to a thin rail. */
function InspectorRail() {
  const open = useUiStore((state) => state.inspectorOpen);
  const setPanel = useUiStore((state) => state.setPanel);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setPanel("inspector", true)}
        aria-label="Show node inspector"
        className={cn(
          "flex w-10 shrink-0 flex-col items-center gap-2 border-l border-border bg-surface py-3",
          "text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        <PanelRight className="size-4" aria-hidden />
        <span
          className="text-[10px] font-medium tracking-[0.14em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          Inspect
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border">
      <Inspector className="min-h-0 flex-1 border-l-0" />
      <RailToggle
        side="right"
        label="Hide node inspector"
        onClick={() => setPanel("inspector", false)}
      />
    </div>
  );
}

function RailToggle({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? PanelLeft : PanelRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 shrink-0 items-center justify-center gap-1.5 border-t border-border/70",
        "text-[11px] text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      Collapse
    </button>
  );
}
