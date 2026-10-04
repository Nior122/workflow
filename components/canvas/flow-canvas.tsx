"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ConnectionMode,
  useReactFlow,
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { edgeTypes } from "@/components/edges";
import { cn } from "@/lib/utils";
import { ZoomControls } from "./zoom-controls";
import { EmptyCanvas } from "./empty-canvas";
import { ConnectionErrorToast } from "./connection-error-toast";
import { QuickAddPopover } from "./quick-add-popover";
import { ApprovalBanner } from "./approval-banner";
import { AgentTraceDrawer } from "./agent-trace-drawer";
import { useCanvasElement } from "./canvas-context";
import { useViewportTier } from "@/hooks/use-viewport-tier";
import { useCanvasDrop } from "@/hooks/use-canvas-actions";
import { getNodeUi } from "@/components/nodes/registry";
import { useIsEmptyCanvas, useWorkflowStore } from "@/store/workflowStore";
import { useUiStore } from "@/store/uiStore";
import {
  GRID_DOT_SIZE,
  GRID_GAP,
  MAX_ZOOM,
  MIN_ZOOM,
  PANE_DOUBLE_CLICK_MS,
} from "@/config/constants";
import type { NodeType } from "@/types/nodes";
import type { Viewport } from "@/types/workflow";

/** Only source → target connections; loose mode would let outputs chain to outputs. */
const CONNECTION_MODE = ConnectionMode.Strict;

/**
 * The canvas. Must be rendered inside <ReactFlowProvider> (AppShell provides it).
 *
 * All React Flow interaction is funnelled through here and through `hooks/`; node
 * components never mutate the store, which avoids the drag-time double-render trap
 * recorded in PROJECT_NOTES.md §8.
 */
export function FlowCanvas({ minimapVisible }: { minimapVisible: boolean }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const setViewport = useWorkflowStore((state) => state.setViewport);
  const isEmpty = useIsEmptyCanvas();
  const openInspector = useUiStore((state) => state.setPanel);

  // onNodeClick fires for a click but not for a drag, which is exactly the
  // distinction needed: tapping a node should reveal its inspector, while dragging
  // one around must not throw a panel over the canvas.
  const handleNodeClick = useCallback(
    () => openInspector("inspector", true),
    [openInspector],
  );

  const canvasRef = useCanvasElement();
  const { onDragOver, onDrop } = useCanvasDrop();
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);
  const { screenToFlowPosition } = useReactFlow();

  const defaultEdgeOptions = useMemo(
    () => ({ type: "animated-flow" as const, data: { active: false } }),
    [],
  );

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => setViewport(viewport),
    [setViewport],
  );

  // Double-clicking empty canvas opens the quick-add command popup at that spot.
  // React Flow has no `onPaneDoubleClick`, so `onPaneClick` is paired with a short
  // timer: two clicks inside PANE_DOUBLE_CLICK_MS count as one double-click.
  const lastPaneClickAt = useRef(0);
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastPaneClickAt.current > PANE_DOUBLE_CLICK_MS) {
        lastPaneClickAt.current = now;
        return;
      }
      lastPaneClickAt.current = 0;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      openQuickAdd({ position });
    },
    [openQuickAdd, screenToFlowPosition],
  );

  return (
    <div ref={canvasRef} className="relative h-full w-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={handleMoveEnd}
        proOptions={{ hideAttribution: false }}
        connectionMode={CONNECTION_MODE}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Meta", "Shift", "Control"]}
        selectionKeyCode="Shift"
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable
        nodesDraggable
        elementsSelectable
        // One finger pans the canvas, two pinch-zoom. Without this the default
        // wheel/trackpad zoom mapping swallows touch scroll on phones.
        zoomOnPinch
        panOnDrag
        elevateNodesOnSelect
        className="!bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_GAP}
          size={GRID_DOT_SIZE}
          color="hsl(var(--grid-dot))"
        />

        {minimapVisible && !isEmpty && (
          <MiniMap
            pannable
            zoomable
            // Top-right, deliberately. React Flow pins its own attribution to
            // bottom-right (kept, per their terms) and the zoom controls own
            // bottom-left, so bottom-right was the one corner where two panels
            // were painted on top of each other. All four corners now have at
            // most one occupant, and this is hidden when the canvas is empty so
            // it can never meet the empty state.
            position="top-right"
            className="!bg-surface"
            maskColor="hsl(var(--background) / 0.72)"
            nodeColor={(node) =>
              node.type ? getNodeUi(node.type as NodeType).accent : "hsl(var(--muted-foreground))"
            }
            nodeStrokeWidth={0}
          />
        )}
      </ReactFlow>

      <TierAwareZoomControls />

      {isEmpty && <EmptyCanvas />}

      <QuickAddPopover />

      <ApprovalBanner />

      <ConnectionErrorToast />

      <AgentTraceDrawer />

      {/* Canvas state is otherwise purely visual; keep it available to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {isEmpty
          ? "Canvas is empty. Use the node palette to add your first node."
          : `Canvas has ${nodes.length} node${nodes.length === 1 ? "" : "s"} and ${edges.length} connection${edges.length === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}


/**
 * Zoom controls, moved out of the way of the bottom app bar on narrow viewports.
 * Bottom-left is fine when the console is docked; on a phone that is exactly where
 * the dock lives.
 */
function TierAwareZoomControls() {
  const tier = useViewportTier();

  return (
    <ZoomControls
      className={cn(
        "absolute z-canvas-overlay",
        tier === "compact" ? "top-3 right-3" : "bottom-5 left-5",
      )}
    />
  );
}
