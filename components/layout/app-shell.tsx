"use client";

import { useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { TopBar } from "./top-bar";
import { MobileNotice } from "./mobile-notice";
import { Palette } from "@/components/panels/palette";
import { Inspector } from "@/components/panels/inspector";
import { BottomPanel } from "@/components/panels/bottom-panel";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { CanvasElementProvider } from "@/components/canvas/canvas-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAddNodeAtCenter } from "@/hooks/use-canvas-actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLiveValidation } from "@/hooks/use-live-validation";
import { usePersistence } from "@/hooks/use-persistence";
import { MOBILE_BREAKPOINT_PX } from "@/config/constants";
import { useUiStore } from "@/store/uiStore";

/**
 * Builder layout: top bar over palette | canvas | inspector, with the run console
 * docked underneath.
 *
 * ReactFlowProvider sits at this level rather than around the canvas alone so the
 * palette can ask the flow instance for the visible centre when adding a node by
 * keyboard.
 */
export function AppShell() {
  const isNarrow = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
  const showMinimap = useUiStore((state) => state.showMinimap);

  // Hydrates from localStorage or a share link, then auto-saves on change.
  usePersistence();
  const hydration = useUiStore((state) => state.hydration);

  // Writes graph-level validation issues onto the nodes that caused them.
  useLiveValidation();

  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <CanvasElementProvider>
          <div className="flex h-dvh flex-col overflow-hidden bg-background">
            <TopBar />

            {isNarrow && <MobileNotice />}

            {hydration === "unavailable" && (
              <p
                role="status"
                className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning"
              >
                Browser storage is unavailable, so this session will not be saved. Export your
                workflow to keep it.
              </p>
            )}

            <div className="flex min-h-0 flex-1">
              {!isNarrow && <PaletteWrapper />}

              <main className="relative min-w-0 flex-1">
                <FlowCanvas minimapVisible={showMinimap && !isNarrow} readOnly={isNarrow} />
              </main>

              {!isNarrow && <Inspector />}
            </div>

            {!isNarrow && <BottomPanel />}
          </div>
        </CanvasElementProvider>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

/** Bridge so the palette gets the canvas-centre callback from inside the provider. */
function PaletteWrapper() {
  const addNodeAtCenter = useAddNodeAtCenter();
  const handleAddAtCenter = useCallback(() => addNodeAtCenter(), [addNodeAtCenter]);

  return <Palette onAddAtViewportCenter={handleAddAtCenter} />;
}
