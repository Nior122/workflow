"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ConnectionMode,
} from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import { edgeTypes } from "@/components/edges";
import { ZoomControls } from "./zoom-controls";
import { EmptyCanvas } from "./empty-canvas";
import { ConnectionErrorToast } from "@/components/panels/palette";
import { useCanvasElement } from "./canvas-context";
import { useCanvasDrop } from "@/hooks/use-canvas-actions";
import { getNodeUi } from "@/components/nodes/registry";
import { useIsEmptyCanvas, useWorkflowStore } from "@/store/workflowStore";
import { GRID_DOT_SIZE, GRID_GAP, MAX_ZOOM, MIN_ZOOM } from "@/config/constants";
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
export function FlowCanvas({
  minimapVisible,
  readOnly = false,
}: {
  minimapVisible: boolean;
  /** Mobile fallback: pan and zoom still work, editing does not. */
  readOnly?: boolean;
}) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const setViewport = useWorkflowStore((state) => state.setViewport);
  const isEmpty = useIsEmptyCanvas();

  const canvasRef = useCanvasElement();
  const { onDragOver, onDrop } = useCanvasDrop();

  const defaultEdgeOptions = useMemo(
    () => ({ type: "animated-flow" as const, data: { active: false } }),
    [],
  );

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => setViewport(viewport),
    [setViewport],
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
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={handleMoveEnd}
        connectionMode={CONNECTION_MODE}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        multiSelectionKeyCode={["Meta", "Shift", "Control"]}
        selectionKeyCode="Shift"
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable={!readOnly}
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
            position="bottom-right"
            className="!bg-surface"
            maskColor="hsl(var(--background) / 0.72)"
            nodeColor={(node) =>
              node.type ? getNodeUi(node.type as NodeType).accent : "hsl(var(--muted-foreground))"
            }
            nodeStrokeWidth={0}
          />
        )}
      </ReactFlow>

      <ZoomControls className="absolute bottom-5 left-5 z-10" />

      {isEmpty && <EmptyCanvas />}

      <ConnectionErrorToast />

      {/* Canvas state is otherwise purely visual; keep it available to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {isEmpty
          ? "Canvas is empty. Use the node palette to add your first node."
          : `Canvas has ${nodes.length} node${nodes.length === 1 ? "" : "s"} and ${edges.length} connection${edges.length === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
