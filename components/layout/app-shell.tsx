"use client";

import { useCallback, type ReactNode } from "react";
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
import { ToastViewport } from "@/components/ui/toast-viewport";
import { useAddNodeAtCenter } from "@/hooks/use-canvas-actions";
import { useViewportTier } from "@/hooks/use-viewport-tier";
import { useLiveValidation } from "@/hooks/use-live-validation";
import { usePersistence } from "@/hooks/use-persistence";
import { useUiStore } from "@/store/uiStore";
import { builderGridColumns } from "./shell-tracks";
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
  // Read here rather than in the rails: the grid track widths have to change in
  // the same commit as the rail contents, or the canvas resizes a frame late.
  const paletteOpen = useUiStore((state) => state.paletteOpen);
  const inspectorOpen = useUiStore((state) => state.inspectorOpen);

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
            {/* One column, three rows: chrome / canvas / dock. No side panels
                exist at this tier, so there is nothing for the canvas to sit
                underneath. */}
            <div
              className="grid h-dvh overflow-hidden bg-background"
              style={{
                gridTemplateColumns: "minmax(0, 1fr)",
                gridTemplateRows: "auto minmax(0, 1fr) auto",
              }}
            >
              <ShellHeader storageWarning={storageWarning} />
              <main className="relative min-w-0 overflow-hidden">
                <FlowCanvas minimapVisible={false} />
              </main>
              <MobileDock />
              <ToastViewport />
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
          {/* The whole builder is ONE grid, never nested flex boxes:

                 row 1   [            chrome             ]
                 row 2   [ palette ][ canvas ][ inspector ]
                 row 3   [          run console          ]

              The canvas owns row 2 / column 2 outright, so it is impossible
              for another panel to be painted over it — the panels are
              siblings in adjacent tracks, not overlapping layers. Collapsing a
              rail changes its track width, which the canvas absorbs because its
              track is minmax(0, 1fr). Animating grid-template-columns makes the
              collapse a smooth resize rather than a layout jump. */}
          <div
            className="grid h-dvh overflow-hidden bg-background transition-[grid-template-columns] duration-200 ease-out"
            style={{
              gridTemplateColumns: builderGridColumns({ paletteOpen, inspectorOpen }),
              gridTemplateRows: "auto minmax(0, 1fr) auto",
            }}
          >
            <ShellHeader storageWarning={storageWarning} />

            <PaletteRail />

            <main className="relative min-w-0 overflow-hidden">
              <FlowCanvas minimapVisible={showMinimap} />
            </main>

            <InspectorRail />

            <BottomPanel />
            <ToastViewport />
          </div>
        </CanvasElementProvider>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

/** Top bar plus the optional storage warning, as a single grid row. */
function ShellHeader({ storageWarning }: { storageWarning: ReactNode }) {
  return (
    // `min-w-0` so a long workflow name cannot widen the row and blow out the
    // grid. Deliberately NOT `overflow-hidden`: the top bar's blocking-error
    // alert is `absolute top-full`, i.e. it hangs below the bar's own box, so
    // clipping here would hide the one message that tells you why a run was
    // refused. Nothing in this row can overflow vertically — the bar is a fixed
    // height and the warning is a single centred line.
    <div className="col-span-full flex min-w-0 flex-col">
      <TopBar />
      {storageWarning}
    </div>
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
          "flex min-w-0 flex-col items-center gap-2 overflow-hidden border-r border-border bg-surface py-3",
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
    <div className="flex min-w-0 flex-col overflow-hidden border-r border-border">
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
          "flex min-w-0 flex-col items-center gap-2 overflow-hidden border-l border-border bg-surface py-3",
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
    <div className="flex min-w-0 flex-col overflow-hidden border-l border-border">
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
        "flex h-8 shrink-0 items-center justify-center gap-2 border-t border-border/70",
        "text-[11px] text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground active:bg-border",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      Collapse
    </button>
  );
}
