"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useEdgeAnimation, useEdgeTelemetry } from "@/store/runStore";
import type { FlowEdge } from "@/types/edges";

/** Three particles, staggered, so a stream reads as continuous flow. */
const PARTICLE_OFFSETS = [0, 0.33, 0.66];

const PORT_COLORS: Record<string, string> = {
  ai_model: "#10B981",
  ai_memory: "#14B8A6",
  ai_tool: "#F59E0B",
};

/**
 * The project's single edge type.
 *
 * While a payload is in flight it renders glowing particles that travel the exact
 * bezier the edge is drawn with. The motion is driven by SVG `animateMotion` with
 * an inline `path`, so the browser composites it — no per-frame JS, which is what
 * keeps a 60-node graph smooth.
 *
 * AI sub-node edges (`ai_model`, `ai_memory`, `ai_tool`) are dashed and tinted per
 * port kind, and light up when the agent invokes the connected tool or sub-agent.
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
  const telemetry = useEdgeTelemetry(id);

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
  const portKind = data?.portKind ?? "main";
  const isSubNodeEdge = portKind !== "main";
  const portColor = PORT_COLORS[portKind] ?? "hsl(var(--accent-hot))";
  const itemCount = telemetry?.itemCount ?? data?.itemCount;

  return (
    <>
      {/* Under-glow while data moves, so the path itself looks energised. */}
      {active && (
        <path
          d={edgePath}
          fill="none"
          stroke={portColor}
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
        style={isSubNodeEdge ? { strokeDasharray: "5 4" } : undefined}
        className={cn(
          "!stroke-border transition-[stroke,opacity] duration-200",
          selected && "!stroke-accent",
          active && "!stroke-accent-hot",
          data?.dimmed && "opacity-25",
        )}
      />

      {isSubNodeEdge && (
        <path
          d={edgePath}
          fill="none"
          stroke={portColor}
          strokeWidth={active ? 2.4 : 1.4}
          strokeOpacity={active ? 1 : 0.4}
          strokeDasharray="5 4"
          className="pointer-events-none transition-[stroke-width,stroke-opacity] duration-200"
        />
      )}

      {active && (
        <g className="pointer-events-none">
          {PARTICLE_OFFSETS.map((offset) => (
            <circle
              key={offset}
              r={3.2}
              fill={portColor}
              style={{ filter: `drop-shadow(0 0 4px ${portColor})` }}
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
                : data.label === "false"
                  ? "border-error/40 bg-error/15 text-error"
                  : "border-border bg-surface-raised text-muted-foreground",
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

      {/* n8n-style item-count badge: how many items crossed this edge last run. */}
      {typeof itemCount === "number" && itemCount > 0 && !data?.dimmed && (
        <EdgeLabelRenderer>
          <span
            className="pointer-events-none absolute rounded-full border border-border bg-surface-raised px-1.5 py-1 font-mono text-[9px] leading-none text-muted-foreground tabular-nums select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 14}px)`,
            }}
          >
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const AnimatedFlowEdge = memo(AnimatedFlowEdgeInner);
