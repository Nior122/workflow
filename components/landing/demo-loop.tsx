"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS } from "@/components/nodes/registry";

/**
 * Looping flow animation for the landing page.
 *
 * Decorative: `aria-hidden` with a text alternative beside it. It is deliberately
 * *not* built on React Flow — a static SVG plus one interval is far cheaper than
 * mounting a second canvas just to look pretty, and it cannot fight the real one
 * for focus or pointer events.
 *
 * The particle timing and the node lighting share one clock. Each `<animateMotion>`
 * uses `keyTimes`/`keyPoints` so its particle only travels inside its own slot of
 * the cycle and holds still otherwise, which is what makes the flow read as
 * sequential rather than as a conveyor belt.
 */

const CYCLE_MS = 4200;
const PHASES = 6;
const PHASE_MS = CYCLE_MS / PHASES;

type NodeStatus = "idle" | "running" | "success" | "skipped";

/** x, y is the top-left of a 148 x 62 box. */
const NODES = [
  { id: "webhook", label: "Webhook", x: 16, y: 120, accent: ACCENTS["trigger.webhook"] },
  { id: "filter", label: "Filter", x: 210, y: 120, accent: ACCENTS["action.condition"] },
  { id: "ai", label: "AI Prompt", x: 404, y: 46, accent: ACCENTS["action.aiPrompt"] },
  { id: "email", label: "Email", x: 598, y: 46, accent: ACCENTS["output.email"] },
  { id: "log", label: "Log Output", x: 404, y: 194, accent: ACCENTS["output.log"] },
] as const;

const NODE_W = 148;
const NODE_H = 62;

type DemoEdge = {
  id: string;
  /** Cubic bezier matching the builder's edge style (horizontal handles). */
  d: string;
  /** Which phases the particle travels in, or null for a branch this demo never takes. */
  slot: readonly [number, number] | null;
  label?: "true" | "false";
  dim?: boolean;
};

const EDGES: readonly DemoEdge[] = [
  {
    id: "e1",
    // webhook right -> filter left
    d: "M164,151 C187,151 187,151 210,151",
    slot: [1, 2],
  },
  {
    id: "e2",
    // filter right -> ai prompt left (true branch)
    d: "M358,151 C381,151 381,77 404,77",
    slot: [2, 3],
    label: "true",
  },
  {
    id: "e3",
    // ai prompt right -> email left
    d: "M552,77 C575,77 575,77 598,77",
    slot: [3, 4],
  },
  {
    id: "e4",
    // filter right -> log left (false branch, never travelled in this demo)
    d: "M358,151 C381,151 381,225 404,225",
    slot: null,
    label: "false",
    dim: true,
  },
];

/** Payload shown in the fake console strip, one line per phase. */
const CONSOLE_LINES = [
  "▸ trigger.webhook  running…",
  "✓ trigger.webhook  { \"lead\": { \"budget\": 1200 } }",
  "✓ action.condition  budget > 500  →  true",
  "✓ action.aiPrompt  drafted 3 paragraphs",
  "✓ output.email  sent to sales@acme.test",
  "  run completed in 2.4s",
] as const;

function statusAt(phase: number, id: string): NodeStatus {
  switch (id) {
    case "webhook":
      return phase >= 1 ? "success" : "running";
    case "filter":
      return phase >= 2 ? "success" : phase === 1 ? "running" : "idle";
    case "ai":
      return phase >= 3 ? "success" : phase === 2 ? "running" : "idle";
    case "email":
      return phase >= 4 ? "success" : phase === 3 ? "running" : "idle";
    case "log":
      return phase >= 2 ? "skipped" : "idle";
    default:
      return "idle";
  }
}

/** keyTimes/keyPoints that hold the particle still outside [start, end]. */
function slotTiming(slot: readonly [number, number]): { keyTimes: string; keyPoints: string } {
  const a = slot[0] / PHASES;
  const b = slot[1] / PHASES;
  return {
    keyTimes: `0;${a.toFixed(4)};${b.toFixed(4)};1`,
    keyPoints: "0;0;1;1",
  };
}

export function DemoLoop({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Respect the OS setting: freeze on the finished frame, start no timer.
    if (reducedMotion) return;

    const timer = setInterval(() => {
      setPhase((current) => (current + 1) % PHASES);
    }, PHASE_MS);

    return () => clearInterval(timer);
  }, [reducedMotion]);

  const shownPhase = reducedMotion ? PHASES - 1 : phase;

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl",
        className,
      )}
    >
      <div
        aria-hidden
        className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2"
      >
        <span className="size-2.5 rounded-full bg-error/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          lead-capture.workflow
        </span>
      </div>

      <svg
        viewBox="0 0 762 290"
        className="w-full"
        role="img"
        aria-label="Animated diagram: a webhook triggers a filter, which sends an AI-drafted email. A skipped log branch sits below."
      >
        <defs>
          <pattern id="demo-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-border" />
          </pattern>
        </defs>

        <rect width="762" height="290" fill="url(#demo-dots)" opacity="0.55" />

        {EDGES.map((edge) => (
          <g key={edge.id}>
            <path
              d={edge.d}
              fill="none"
              strokeWidth="2"
              className={cn(
                "stroke-border transition-colors duration-300",
                edge.dim && "opacity-45",
              )}
            />

            {edge.label && (
              <text
                x={edge.label === "true" ? 366 : 366}
                y={edge.label === "true" ? 106 : 200}
                className="fill-muted-foreground font-mono text-[9px]"
                textAnchor="middle"
              >
                {edge.label}
              </text>
            )}

            {!reducedMotion && edge.slot && (
              <circle r="4" className="fill-accent">
                <animateMotion
                  dur={`${CYCLE_MS}ms`}
                  repeatCount="indefinite"
                  path={edge.d}
                  calcMode="linear"
                  {...slotTiming(edge.slot)}
                />
                <animate
                  attributeName="opacity"
                  dur={`${CYCLE_MS}ms`}
                  repeatCount="indefinite"
                  values="0;1;1;0"
                  keyTimes={`0;${(edge.slot[0] / PHASES).toFixed(4)};${(
                    edge.slot[1] / PHASES
                  ).toFixed(4)};1`}
                />
              </circle>
            )}
          </g>
        ))}

        {NODES.map((node) => (
          <DemoNode key={node.id} node={node} status={statusAt(shownPhase, node.id)} />
        ))}
      </svg>

      <div
        aria-hidden
        className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2 font-mono text-[10px] sm:text-[11px]"
      >
        <span className="text-accent">$</span>
        <span
          key={shownPhase}
          className="truncate text-muted-foreground transition-opacity duration-200"
        >
          {CONSOLE_LINES[shownPhase]}
        </span>
      </div>

      <figcaption className="sr-only">
        A looping preview of a FlowForge workflow: a webhook hands a lead to a filter, the
        matching branch asks an AI model to draft copy, and the result is emailed. The lower
        branch is skipped.
      </figcaption>
    </figure>
  );
}

function DemoNode({
  node,
  status,
}: {
  node: (typeof NODES)[number];
  status: NodeStatus;
}) {
  const isActive = status === "running";
  const isSkipped = status === "skipped";

  return (
    <g
      className={cn("transition-opacity duration-300", isSkipped && "opacity-45")}
      opacity={isSkipped ? 0.45 : 1}
    >
      {isActive && (
        <rect
          x={node.x - 4}
          y={node.y - 4}
          width={NODE_W + 8}
          height={NODE_H + 8}
          rx="12"
          fill="none"
          stroke={node.accent}
          strokeWidth="1.5"
          opacity="0.5"
        >
          <animate
            attributeName="opacity"
            values="0.15;0.6;0.15"
            dur="1.1s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      <rect
        x={node.x}
        y={node.y}
        width={NODE_W}
        height={NODE_H}
        rx="10"
        className="fill-surface-raised stroke-border"
        strokeWidth="1.5"
      />

      <rect
        x={node.x}
        y={node.y}
        width="4"
        height={NODE_H}
        rx="2"
        fill={node.accent}
      />

      <text
        x={node.x + 16}
        y={node.y + 26}
        className="fill-foreground text-[12px] font-semibold"
      >
        {node.label}
      </text>

      <text
        x={node.x + 16}
        y={node.y + 44}
        className="fill-muted-foreground font-mono text-[9px]"
      >
        {status === "running"
          ? "running…"
          : status === "success"
            ? "success"
            : status === "skipped"
              ? "skipped"
              : "queued"}
      </text>

      {status === "success" && (
        <g className="text-success">
          <circle cx={node.x + NODE_W - 14} cy={node.y + 14} r="8" className="fill-success/15" />
          <Check
            x={node.x + NODE_W - 19}
            y={node.y + 9}
            width="10"
            height="10"
            className="stroke-success"
            strokeWidth="3"
            aria-hidden
          />
        </g>
      )}

      {isActive && (
        <Loader2
          x={node.x + NODE_W - 19}
          y={node.y + 9}
          width="10"
          height="10"
          className="animate-spin text-accent"
          aria-hidden
        />
      )}

      {/* Input / output handles */}
      {node.id !== "webhook" && (
        <circle cx={node.x} cy={node.y + NODE_H / 2} r="4" className="fill-border" />
      )}
      {node.id !== "email" && node.id !== "log" && (
        <circle
          cx={node.x + NODE_W}
          cy={node.y + NODE_H / 2}
          r="4"
          className="fill-border"
        />
      )}
    </g>
  );
}
