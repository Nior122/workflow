"use client";

import { useCallback, type DragEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { NODE_DRAG_TYPE, NODE_WIDTH } from "@/config/constants";
import { useCanvasElement } from "@/components/canvas/canvas-context";
import { useWorkflowStore } from "@/store/workflowStore";
import { isNodeTypeImplemented } from "@/lib/engine/registry";
import type { NodeType } from "@/types/nodes";

/** Centre of the visible canvas pane, converted to flow coordinates. */
export function useAddNodeAtCenter() {
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useCanvasElement();

  return useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const clientX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const clientY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const point = screenToFlowPosition({ x: clientX, y: clientY });

    // Offset by half the node width so the node lands visually centred.
    return { x: point.x - NODE_WIDTH / 2, y: point.y - 40 };
  }, [canvasRef, screenToFlowPosition]);
}

/**
 * Palette → canvas drag-and-drop.
 * Returns the handlers to spread onto the React Flow wrapper.
 */
export function useCanvasDrop() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useWorkflowStore((state) => state.addNode);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!type || !isNodeTypeImplemented(type as NodeType)) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type as NodeType, { x: position.x - NODE_WIDTH / 2, y: position.y - 24 });
    },
    [addNode, screenToFlowPosition],
  );

  return { onDragOver, onDrop };
}
