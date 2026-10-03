"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { FlowEdge } from "@/types/edges";

/**
 * The project's single edge type.
 *
 * Phase 1 renders a themed bezier plus the true/false branch label. Phase 4 layers
 * the travelling-particle animation on top, driven by `data.active` — the prop is
 * already part of the shape so the upgrade does not touch the edge contract.
 */
function AnimatedFlowEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<FlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "!stroke-border transition-[stroke,opacity] duration-200",
          selected && "!stroke-accent",
          data?.active && "!stroke-accent-hot",
          data?.dimmed && "opacity-30",
        )}
      />

      {data?.label && (
        <EdgeLabelRenderer>
          <span
            className={cn(
              "pointer-events-none absolute rounded-full border px-1.5 py-0.5",
              "font-mono text-[10px] leading-none select-none",
              data.label === "true"
                ? "border-success/40 bg-success/15 text-success"
                : "border-error/40 bg-error/15 text-error",
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const AnimatedFlowEdge = memo(AnimatedFlowEdgeInner);
