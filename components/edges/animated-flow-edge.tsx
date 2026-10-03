"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useEdgeAnimation } from "@/store/runStore";
import type { FlowEdge } from "@/types/edges";

/** Three particles, staggered, so a stream reads as continuous flow. */
const PARTICLE_OFFSETS = [0, 0.33, 0.66];

/**
 * The project's single edge type.
 *
 * While a payload is in flight it renders glowing particles that travel the exact
 * bezier the edge is drawn with. The motion is driven by SVG `animateMotion` with
 * an inline `path`, so the browser composites it — no per-frame JS, which is what
 * keeps a 20-node graph smooth (see PROJECT_NOTES.md §8).
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
  const animation = useEdgeAnimation(id);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  });

  const active = Boolean(animation);
  const travelSeconds = animation ? Math.max(0.25, animation.durationMs / 1000) : 1;

  return (
    <>
      {/* Under-glow while data moves, so the path itself looks energised. */}
      {active && (
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--accent-hot))"
          strokeWidth={6}
          strokeOpacity={0.22}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "!stroke-border transition-[stroke,opacity] duration-200",
          selected && "!stroke-accent",
          active && "!stroke-accent-hot",
          data?.dimmed && "opacity-25",
        )}
      />

      {active && (
        <g className="pointer-events-none">
          {PARTICLE_OFFSETS.map((offset) => (
            <circle
              key={offset}
              r={3.2}
              fill="hsl(var(--accent-hot))"
              style={{ filter: "drop-shadow(0 0 4px hsl(var(--accent-hot)))" }}
            >
              <animateMotion
                dur={`${travelSeconds}s`}
                begin={`${offset * travelSeconds}s`}
                repeatCount="indefinite"
                path={edgePath}
                rotate="auto"
              />
            </circle>
          ))}
        </g>
      )}

      {data?.label && (
        <EdgeLabelRenderer>
          <span
            className={cn(
              "pointer-events-none absolute rounded-full border px-2 py-1",
              "font-mono text-[10px] leading-none select-none",
              data.label === "true"
                ? "border-success/40 bg-success/15 text-success"
                : "border-error/40 bg-error/15 text-error",
              data.dimmed && "opacity-40",
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
